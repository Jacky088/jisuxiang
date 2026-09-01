'use client';

import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUpload, 
  faSpinner, 
  faDownload, 
  faCopy, 
  faCheck, 
  faTrash,
  faFileCode
} from '@fortawesome/free-solid-svg-icons';
import ToolHeader from '@/components/ToolHeader';
import BackToTop from '@/components/BackToTop';
import tools from '@/config/tools';
import { apiClient } from '@/lib/api-client';
import { useLanguage } from '@/context/LanguageContext';

// 转换结果接口
interface ConversionResult {
  markdown_content: string;
  conversion_time_seconds: number;
  original_filename?: string;
}

interface FileTask {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  markdown?: string;
  error?: string;
  timeSeconds?: number;
}

// CSS样式
const styles = {
  container: "min-h-screen flex flex-col max-w-[1440px] mx-auto p-4 md:p-6",
  card: "card p-6",
  actionBar: "flex flex-wrap items-center justify-between gap-3 p-4 bg-block rounded-lg border border-purple-glow mb-6",
  uploadSection: "flex flex-col items-center p-6 bg-block rounded-lg border-2 border-dashed border-purple-glow/50 cursor-pointer hover:border-purple-glow transition-colors mb-6",
  uploadIcon: "text-purple text-3xl mb-4",
  uploadText: "text-center text-secondary mb-2",
  supportedFormats: "text-center text-sm text-tertiary",
  hiddenInput: "hidden",
  loading: "flex flex-col items-center justify-center p-6 bg-block rounded-lg mb-6",
  spinner: "animate-spin text-purple text-2xl mb-4",
  loadingText: "text-secondary",
  fileName: "text-sm text-secondary max-w-full truncate",
  fileInfo: "flex items-center p-4 bg-block-strong rounded-lg border border-purple-glow/30 mb-4",
  fileIcon: "text-purple mr-3 text-xl",
  fileDetails: "flex-1",
  fileActions: "flex gap-2",
  listContainer: "space-y-3 mb-4",
  itemRow: "flex items-center p-3 bg-block-strong rounded-lg border border-purple-glow/20",
  itemName: "flex-1 text-sm text-secondary truncate",
  itemMeta: "text-xs text-tertiary ml-2",
  itemStatus: "text-xs ml-3",
  resultContainer: "w-full",
  resultHeader: "flex items-center justify-between mb-4",
  resultTitle: "text-lg font-medium text-primary",
  markdownOutput: "w-full h-[500px] p-4 bg-block-strong border border-purple-glow/30 rounded-lg text-primary font-mono text-sm resize-y overflow-auto focus:outline-none focus:border-purple focus:ring-1 focus:ring-purple",
  buttonGroup: "flex flex-wrap gap-3",
  actionButton: "btn-secondary flex items-center",
  convertButton: "btn-primary flex items-center",
  iconMargin: "mr-2",
  infoBox: "p-4 bg-block rounded-lg border border-purple-glow/30 mb-6",
  infoText: "text-tertiary text-sm",
  errorContainer: "p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 mb-6",
  successContainer: "p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-500 mb-6",
  warningText: "text-yellow-500 text-sm mt-2",
};

// 支持的文件格式
const SUPPORTED_FILE_FORMATS = [
  // anydoc 原生支持
  '.doc', '.docx', '.docm',
  '.ppt', '.pptx', '.pptm', '.pps', '.ppsx', '.ppsm', '.pot',
  '.xls', '.xlsx', '.xlsm', '.xlsb',
  '.odt', '.ods', '.odp',
  '.rtf', '.epub', '.csv', '.pdf',
  // 服务端补充支持
  '.html', '.htm', '.txt', '.md', '.json', '.xml',
];

// 文件大小限制（50MB）
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function FileToMarkdownConverter() {
  // 使用语言上下文
  const { t } = useLanguage();
  
  // 从工具配置中获取当前工具信息
  const toolConfig = tools.find(tool => tool.code === 'file_to_markdown_converter');
  
  // 状态管理
  const [files, setFiles] = useState<File[]>([]);
  const [tasks, setTasks] = useState<FileTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFileTooLarge, setIsFileTooLarge] = useState(false);
  
  // 引用
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markdownTextAreaRef = useRef<HTMLTextAreaElement>(null);
  
  // 提交文件进行转换（批量）
  const handleSubmit = async () => {
    if (!files.length) {
      setError(t('tools.file_to_markdown_converter.no_file_selected'));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);

    // 初始化任务
    const initTasks: FileTask[] = files.map(f => ({
      file: f,
      status: 'pending'
    }));
    setTasks(initTasks);

    let successCount = 0;
    let failedCount = 0;

    const newTasks: FileTask[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const current = files[i];
      newTasks.push({ file: current, status: 'processing' });
      setTasks([...newTasks, ...initTasks.slice(i + 1)]);
      try {
        const result = await apiClient.uploadFile<ConversionResult>('/api/markdown-convert', current);
        successCount += 1;
        newTasks[i] = {
          file: current,
          status: 'success',
          markdown: result.markdown_content,
          timeSeconds: result.conversion_time_seconds
        };
      } catch (e) {
        failedCount += 1;
        newTasks[i] = {
          file: current,
          status: 'error',
          error: (e as Error).message || t('tools.file_to_markdown_converter.conversion_error')
        };
      }
      setTasks([...newTasks, ...initTasks.slice(i + 1)]);
    }

    setSuccess(
      t('tools.file_to_markdown_converter.batch_done')
        .replace('{success}', `${successCount}`)
        .replace('{failed}', `${failedCount}`)
    );
    setLoading(false);
  };
  
  // 处理文件选择
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length) return;

    setError(null);
    setSuccess(null);
    setCopied(false);
    setIsFileTooLarge(false);

    const valid: File[] = [];
    const skipped: string[] = [];
    for (const f of selected) {
      const ext = f.name.toLowerCase().split('.').pop();
      if (!ext || !SUPPORTED_FILE_FORMATS.includes('.' + ext)) {
        skipped.push(f.name);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setIsFileTooLarge(true);
        setError(t('tools.file_to_markdown_converter.file_too_large').replace('{size}', (f.size / (1024 * 1024)).toFixed(2)));
        continue;
      }
      valid.push(f);
    }
    if (skipped.length) {
      setError(t('tools.file_to_markdown_converter.unsupported_format').replace('{files}', skipped.join(', ')));
    }

    setFiles(prev => {
      const names = new Set(prev.map(p => p.name));
      const merged = [...prev];
      for (const f of valid) {
        if (!names.has(f.name)) merged.push(f);
      }
      return merged;
    });
    setTasks([]);
  };
  
  // 打开文件选择器
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };
  
  // 处理拖放文件
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const dropped = Array.from(event.dataTransfer.files || []);
    if (!dropped.length) return;

    setError(null);
    setSuccess(null);
    setCopied(false);
    setIsFileTooLarge(false);

    const filtered: File[] = [];
    const skipped: string[] = [];
    for (const f of dropped) {
      const ext = f.name.toLowerCase().split('.').pop();
      if (!ext || !SUPPORTED_FILE_FORMATS.includes('.' + ext)) {
        skipped.push(f.name);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) continue;
      filtered.push(f);
    }
    if (skipped.length) {
      setError(t('tools.file_to_markdown_converter.unsupported_format').replace('{files}', skipped.join(', ')));
    }

    setFiles(prev => {
      const names = new Set(prev.map(p => p.name));
      const merged = [...prev];
      for (const f of filtered) {
        if (!names.has(f.name)) merged.push(f);
      }
      return merged;
    });
    setTasks([]);
  };
  
  // 防止默认拖放行为
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  // 复制Markdown到剪贴板（若仅一个成功结果）
  const copyToClipboard = () => {
    const first = tasks.find(tk => tk.status === 'success' && tk.markdown);
    if (!first?.markdown) return;
    navigator.clipboard.writeText(first.markdown)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error(t('tools.file_to_markdown_converter.copy_failed'), err);
        setError(t('tools.file_to_markdown_converter.copy_failed'));
      });
  };
  
  // 下载单个Markdown
  const downloadOne = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = fileName.split('.').slice(0, -1).join('.') || fileName;
    link.download = `${baseName}.md`;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  };

  // 批量下载（逐个触发下载）
  const downloadAll = () => {
    const succeeded = tasks.filter(tk => tk.status === 'success' && tk.markdown);
    let delay = 0;
    for (const tk of succeeded) {
      setTimeout(() => downloadOne(tk.file.name, tk.markdown as string), delay);
      delay += 150;
    }
  };
  
  // 清除选中的文件和结果
  const clearAll = () => {
    setFiles([]);
    setTasks([]);
    setError(null);
    setSuccess(null);
    setCopied(false);
    setIsFileTooLarge(false);
    
    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  return (
    <div className={styles.container}>
      {/* 工具头部 */}
      {toolConfig && (
        <ToolHeader 
          title={toolConfig.title || ''}
          description={toolConfig.description || ''}
          icon={toolConfig.icon}
          toolCode="file_to_markdown_converter"
        />
      )}
      
      {/* 提示信息 */}
      <div className={styles.infoBox}>
        <p className={styles.infoText}>
          {t('tools.file_to_markdown_converter.description')}
        </p>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className={styles.errorContainer}>
          {error}
        </div>
      )}
      
      {/* 成功提示 */}
      {success && (
        <div className={styles.successContainer}>
          {success}
        </div>
      )}
      
      {/* 始终显示上传区域 */}
      <div 
        className={styles.uploadSection}
        onClick={handleSelectFile}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <FontAwesomeIcon icon={faUpload} className={styles.uploadIcon} />
        <p className={styles.uploadText}>
          {files.length ? t('tools.file_to_markdown_converter.select_files') : t('tools.file_to_markdown_converter.drop_file_here')}
        </p>
        <p className={styles.supportedFormats}>
          {t('tools.file_to_markdown_converter.supported_formats')}
        </p>
        <p className={styles.warningText}>{t('tools.file_to_markdown_converter.file_too_large').replace('{size}', '50')}</p>
        <input
          type="file"
          ref={fileInputRef}
          className={styles.hiddenInput}
          onChange={handleFileChange}
          multiple
          accept={SUPPORTED_FILE_FORMATS.join(',')}
        />
      </div>
      
      {/* 文件列表与操作 */}
      {files.length > 0 && !isFileTooLarge && (
        <div className={styles.card}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-secondary text-sm">
              {t('tools.file_to_markdown_converter.files_selected').replace('{count}', `${files.length}`)}
            </div>
            <div className={styles.fileActions}>
              <button 
                className={styles.convertButton}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin className={styles.iconMargin} />
                    {t('tools.file_to_markdown_converter.converting')}
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faFileCode} className={styles.iconMargin} />
                    {t('tools.file_to_markdown_converter.convert_all')}
                  </>
                )}
              </button>
              <button 
                className={styles.actionButton}
                onClick={downloadAll}
                disabled={tasks.filter(tk => tk.status === 'success').length === 0}
              >
                <FontAwesomeIcon icon={faDownload} className={styles.iconMargin} />
                {t('tools.file_to_markdown_converter.download_all')}
              </button>
              <button 
                className={styles.actionButton}
                onClick={clearAll}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faTrash} className={styles.iconMargin} />
                {t('tools.file_to_markdown_converter.clear_all')}
              </button>
            </div>
          </div>

          <div className={styles.listContainer}>
            {files.map((f) => {
              const task = tasks.find(tk => tk.file.name === f.name);
              return (
                <div key={f.name} className={styles.itemRow}>
                  <FontAwesomeIcon icon={faFileCode} className={styles.fileIcon} />
                  <div className={styles.itemName}>
                    {f.name}
                    <span className={styles.itemMeta}>
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className={styles.itemStatus}>
                    {task?.status === 'processing' && (
                      <span className="text-secondary flex items-center">
                        <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                        {t('tools.file_to_markdown_converter.converting')}
                      </span>
                    )}
                    {task?.status === 'success' && (
                      <span className="text-green-500">
                        {t('tools.file_to_markdown_converter.conversion_success')
                          .replace('{time}', (task.timeSeconds || 0).toFixed(2))}
                      </span>
                    )}
                    {task?.status === 'error' && (
                      <span className="text-red-500">
                        {task.error || t('tools.file_to_markdown_converter.conversion_error')}
                      </span>
                    )}
                    {!task && <span className="text-tertiary">{t('tools.file_to_markdown_converter.pending')}</span>}
                  </div>
                  {task?.status === 'success' && task.markdown && (
                    <button 
                      className={`${styles.actionButton} ml-3`}
                      onClick={() => downloadOne(f.name, task.markdown as string)}
                    >
                      <FontAwesomeIcon icon={faDownload} className={styles.iconMargin} />
                      {t('tools.file_to_markdown_converter.download')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* 加载状态 */}
      {loading && (
        <div className={styles.loading}>
          <FontAwesomeIcon icon={faSpinner} spin className={styles.spinner} />
          <p className={styles.loadingText}>{t('tools.file_to_markdown_converter.converting')}</p>
        </div>
      )}

      {/* 单个成功结果时提供预览与复制 */}
      {tasks.filter(tk => tk.status === 'success').length === 1 && tasks.find(tk => tk.status === 'success')?.markdown && (
        <div className={styles.resultContainer}>
          <div className={styles.resultHeader}>
            <h3 className={styles.resultTitle}>{t('tools.file_to_markdown_converter.markdown_output')}</h3>
            <div className={styles.buttonGroup}>
              <button 
                className={styles.actionButton}
                onClick={copyToClipboard}
              >
                <FontAwesomeIcon 
                  icon={copied ? faCheck : faCopy} 
                  className={styles.iconMargin} 
                />
                {copied ? t('tools.file_to_markdown_converter.copied') : t('tools.file_to_markdown_converter.copy')}
              </button>
            </div>
          </div>
          <textarea
            ref={markdownTextAreaRef}
            className={styles.markdownOutput}
            value={tasks.find(tk => tk.status === 'success')?.markdown || ''}
            onChange={() => {}}
            spellCheck={false}
            readOnly
          />
        </div>
      )}
      
      {/* 回到顶部按钮 */}
      <BackToTop />
    </div>
  );
} 