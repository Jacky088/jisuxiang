import { NextRequest, NextResponse } from 'next/server';
import { toMarkdownBytes, formatFromExtension } from '@firecrawl/anydoc';
import TurndownService from 'turndown';

// 文件大小限制（50MB）
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// HTML 输入上限：超大 HTML 会拖慢 turndown 转换
const MAX_HTML_INPUT_SIZE = 20 * 1024 * 1024;

// 转换结果上限：防止解压炸弹类文件（如嵌套填充的 xlsx/docx）撑爆内存与响应
const MAX_OUTPUT_SIZE = 20 * 1024 * 1024;

// 单次转换超时（毫秒），防止恶意/病态文件长时间占用解析线程
const CONVERT_TIMEOUT_MS = 30_000;

// 进程内最大并发转换数，防止并发大文件打爆 Node 进程
const MAX_CONCURRENT_CONVERSIONS = 2;
let activeConversions = 0;

/**
 * 带超时的转换执行；超时后停止等待（原生线程中的残余任务随其自然结束）
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        const error = new Error('conversion timeout') as Error & { code?: string };
        error.code = 'timeout';
        reject(error);
      }, ms);
      // 避免定时器持有事件循环
      timer.unref?.();
    }),
  ]);
}

// anydoc 原生支持的格式
const ANYDOC_FORMATS = new Set([
  '.doc', '.docx', '.docm',
  '.ppt', '.pptx', '.pptm', '.pps', '.ppsx', '.ppsm', '.pot',
  '.xls', '.xlsx', '.xlsm', '.xlsb',
  '.odt', '.ods', '.odp',
  '.rtf', '.epub', '.csv', '.pdf',
]);

// 服务端补充支持的纯文本格式（html 用 turndown，其余直接包裹/透传）
const TEXT_FORMATS = new Set(['.html', '.htm', '.txt', '.md', '.json', '.xml']);

const SUPPORTED_FILE_FORMATS = [...ANYDOC_FORMATS, ...TEXT_FORMATS];

// 可接受的 MIME 类型（用于安全校验；浏览器未提供时以扩展名为准）
const ALLOWED_MIME_TYPES = new Set([
  // 新版 Office
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  // 旧版 Office
  'application/msword', // doc
  'application/vnd.ms-powerpoint', // ppt/pps/pot
  'application/vnd.ms-excel', // xls
  // OpenDocument
  'application/vnd.oasis.opendocument.text', // odt
  'application/vnd.oasis.opendocument.spreadsheet', // ods
  'application/vnd.oasis.opendocument.presentation', // odp
  // 其他
  'application/pdf',
  'application/rtf', 'text/rtf',
  'application/epub+zip',
  'text/csv', 'application/csv',
  'text/html',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/xml', 'text/xml',
]);

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

/**
 * anydoc 错误码转用户可读信息
 */
function describeConvertError(error: unknown, fileExtension: string): string {
  const code = (error as { code?: string })?.code || '';
  let message: string;
  switch (code) {
    case 'unsupported':
      message = '文件格式无法识别或不受支持';
      break;
    case 'needsOcr':
      return '该 PDF 为扫描件或纯图片页面，无法提取文本内容';
    case 'malformed':
      message = '文件结构损坏，无法解析';
      break;
    case 'encrypted':
      return '文件已加密或设有密码保护，请先解除密码后再上传';
    case 'resourceLimit':
    case 'missingPart':
      return '文件内容不完整或过于复杂，无法完整解析';
    case 'timeout':
      return '文件处理超时，内容可能过于复杂或文件已损坏';
    default:
      return '文件转换失败，请重试';
  }
  // 旧版 Office 二进制格式兼容性有限，失败时给出可操作的建议
  const LEGACY_OFFICE_FORMATS = new Set(['.doc', '.ppt', '.pps', '.pot', '.xls']);
  if ((code === 'unsupported' || code === 'malformed') && LEGACY_OFFICE_FORMATS.has(fileExtension)) {
    message += '。旧版 Office 格式（.' + fileExtension.slice(1) + '）兼容性有限，建议使用 Microsoft Office 或 WPS 打开该文件，另存为新格式（docx/pptx/xlsx）后再上传';
  }
  return message;
}

/**
 * 纯文本格式转换
 */
function convertTextContent(content: string, ext: string): string {
  if (ext === '.html' || ext === '.htm') {
    return turndownService.turndown(content);
  }
  if (ext === '.json') {
    return '```json\n' + content.trim() + '\n```';
  }
  if (ext === '.xml') {
    return '```xml\n' + content.trim() + '\n```';
  }
  // txt / md 直接透传
  return content;
}

/**
 * 检查文件类型是否安全：扩展名必须在支持列表中，且声明的 MIME 类型必须在白名单内
 */
async function isFileSafe(file: File): Promise<boolean> {
  try {
    const fileName = file.name.toLowerCase();
    const ext = '.' + (fileName.split('.').pop() || '');

    if (!SUPPORTED_FILE_FORMATS.includes(ext)) {
      return false;
    }

    const contentType = file.type;
    // octet-stream 视为未知类型放行：扩展名已校验，且 anydoc 会按字节内容二次检测格式
    if (contentType && contentType !== 'application/octet-stream' && !ALLOWED_MIME_TYPES.has(contentType)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('文件安全检查失败:', error);
    return false;
  }
}

/**
 * 处理文件转Markdown的请求（本地转换，基于 anydoc + turndown，无外部服务依赖）
 */
export async function POST(request: NextRequest) {
  try {
    // 只接受multipart/form-data请求
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: '不支持的请求格式，请使用multipart/form-data' },
        { status: 415 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '没有提供文件' },
        { status: 400 }
      );
    }

    // 检查文件格式
    const fileName = file.name.toLowerCase();
    const fileExtension = '.' + (fileName.split('.').pop() || '');

    if (!SUPPORTED_FILE_FORMATS.includes(fileExtension)) {
      return NextResponse.json(
        { error: `不支持的文件格式：${fileExtension}。支持的格式包括：${SUPPORTED_FILE_FORMATS.join(', ')}` },
        { status: 400 }
      );
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件过大，最大支持50MB（当前文件大小: ${(file.size / (1024 * 1024)).toFixed(2)}MB）` },
        { status: 400 }
      );
    }

    // 进行文件安全检查
    if (!(await isFileSafe(file))) {
      return NextResponse.json(
        { error: '文件类型不安全或与扩展名不匹配' },
        { status: 400 }
      );
    }

    // 并发保护：进程内同时最多 MAX_CONCURRENT_CONVERSIONS 个转换（检查与计数同步执行，无竞态）
    if (activeConversions >= MAX_CONCURRENT_CONVERSIONS) {
      return NextResponse.json(
        { error: '当前转换任务较多，请稍后重试' },
        { status: 503 }
      );
    }
    activeConversions += 1;

    let markdown: string;
    let conversionTimeSeconds: number;
    try {
      // 读取文件字节并转换
      const bytes = Buffer.from(await file.arrayBuffer());

      // 超大 HTML 会拖慢 turndown，直接拒绝
      if ((fileExtension === '.html' || fileExtension === '.htm') && bytes.length > MAX_HTML_INPUT_SIZE) {
        return NextResponse.json(
          { error: `HTML 文件过大（最大支持 ${MAX_HTML_INPUT_SIZE / (1024 * 1024)}MB）` },
          { status: 413 }
        );
      }

      const startTime = performance.now();

      if (ANYDOC_FORMATS.has(fileExtension)) {
        // 仅 CSV 无内容签名需要显式指定格式；其余一律按字节内容检测。
        // 不按扩展名强制指定格式：.doc 等扩展名常与真实内容不符（如 RTF 内容的 .doc），
        // 内容检测能把文件交给正确的解析器，垃圾文件则准确报"格式无法识别"而非"损坏"
        const explicitFormat = fileExtension === '.csv' ? formatFromExtension('.csv') : null;
        markdown = await withTimeout(toMarkdownBytes(bytes, explicitFormat), CONVERT_TIMEOUT_MS);
      } else {
        // charset 从文件自身声明的 MIME 解析（浏览器一般不提供，默认 utf-8）
        const encodingMatch = /charset=([\w-]+)/.exec(file.type);
        const text = bytes.toString((encodingMatch?.[1] as BufferEncoding) || 'utf-8');
        markdown = await withTimeout(
          Promise.resolve(convertTextContent(text, fileExtension)),
          CONVERT_TIMEOUT_MS
        );
      }

      // 输出大小保护
      if (Buffer.byteLength(markdown, 'utf-8') > MAX_OUTPUT_SIZE) {
        return NextResponse.json(
          { error: '文件内容过多，转换结果超出大小限制' },
          { status: 422 }
        );
      }

      conversionTimeSeconds = (performance.now() - startTime) / 1000;
    } catch (error) {
      console.error('文件转换错误:', error);
      return NextResponse.json(
        { error: describeConvertError(error, fileExtension) },
        { status: 422 }
      );
    } finally {
      activeConversions -= 1;
    }

    // 保持与原 markitdown 服务一致的响应结构
    return NextResponse.json({
      id: crypto.randomUUID(),
      original_filename: file.name,
      content_type: file.type,
      conversion_time_seconds: conversionTimeSeconds,
      markdown_content: markdown,
    });
  } catch (error) {
    console.error('文件转换错误:', error);

    return NextResponse.json(
      { error: '服务器处理请求时出错' },
      { status: 500 }
    );
  }
}
