'use client';

import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faNetworkWired, faCopy, faCheck, faCalculator } from '@fortawesome/free-solid-svg-icons';
import ToolHeader from '@/components/ToolHeader';
import { useLanguage } from '@/context/LanguageContext';

// 子网计算结果
interface SubnetResult {
  prefix: number;
  mask: number;
  network: number;
  broadcast: number;
  firstHost: number;
  lastHost: number;
  total: number;
  usable: number;
}

// 子网划分条目
interface SplitSubnet {
  network: number;
  broadcast: number;
  usable: number;
}

const MAX_SPLIT_ROWS = 256;

// 添加CSS变量样式
const styles = {
  card: "card p-6",
  input: "search-input w-full",
  label: "text-secondary font-medium",
  resultItem: "flex justify-between items-center py-2 border-b border-purple-glow/10 gap-2",
  resultLabel: "text-sm text-secondary flex-shrink-0",
  resultValue: "text-sm text-primary font-semibold font-mono text-right break-all",
  iconButton: "text-tertiary hover:text-purple transition-colors",
  primaryBtn: "btn-primary flex items-center justify-center gap-2",
  selectBox: "w-28 px-3 py-1.5 bg-block border border-purple-glow rounded text-sm text-primary focus:outline-none focus:border-purple",
};

// IP 点分十进制转数值（非法返回 null）
const ipToInt = (ip: string): number | null => {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const v = parseInt(part, 10);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
};

// 数值转点分十进制
const intToIp = (n: number): string => {
  return [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join('.');
};

// 前缀长度转掩码数值
const maskFromPrefix = (prefix: number): number => {
  if (prefix === 0) return 0;
  if (prefix === 32) return 4294967295;
  return (2 ** prefix - 1) * 2 ** (32 - prefix);
};

// 掩码数值转前缀长度（非连续掩码返回 null）
const prefixFromMask = (mask: number): number | null => {
  for (let p = 0; p <= 32; p++) {
    if (maskFromPrefix(p) === mask) return p;
  }
  return null;
};

// 解析掩码输入：支持 "24"、"/24"、"255.255.255.0"
const parseMask = (input: string): number | null => {
  const s = input.trim().replace(/^\//, '');
  if (!s) return null;
  if (s.includes('.')) {
    const maskInt = ipToInt(s);
    if (maskInt === null) return null;
    return prefixFromMask(maskInt);
  }
  if (!/^\d{1,2}$/.test(s)) return null;
  const p = parseInt(s, 10);
  return p >= 0 && p <= 32 ? p : null;
};

// 计算子网信息
const computeSubnet = (ip: number, prefix: number): SubnetResult => {
  const mask = maskFromPrefix(prefix);
  const size = 2 ** (32 - prefix);
  const network = Math.floor(ip / size) * size;
  const broadcast = network + size - 1;
  let firstHost = network + 1;
  let lastHost = broadcast - 1;
  let usable = size - 2;
  if (prefix === 31) {
    firstHost = network;
    lastHost = broadcast;
    usable = 2;
  } else if (prefix === 32) {
    firstHost = network;
    lastHost = network;
    usable = 1;
  }
  return { prefix, mask, network, broadcast, firstHost, lastHost, total: size, usable };
};

// 地址类别（基于网络地址首字节）
const getClassLabel = (network: number): string => {
  const first = Math.floor(network / 2 ** 24);
  if (first <= 127) return 'A';
  if (first <= 191) return 'B';
  if (first <= 223) return 'C';
  if (first <= 239) return 'D';
  return 'E';
};

// 地址范围类型 key
const getScopeKey = (network: number): string => {
  const first = Math.floor(network / 2 ** 24);
  const second = Math.floor(network / 2 ** 16) % 256;
  if (first === 10) return 'private';
  if (first === 172 && second >= 16 && second <= 31) return 'private';
  if (first === 192 && second === 168) return 'private';
  if (first === 127) return 'loopback';
  if (first === 169 && second === 254) return 'link_local';
  if (first >= 224 && first <= 239) return 'multicast';
  return 'public';
};

// 数值转点分二进制
const toBinaryDotted = (n: number): string => {
  return [24, 16, 8, 0]
    .map((s) => (Math.floor(n / 2 ** s) % 256).toString(2).padStart(8, '0'))
    .join('.');
};

export default function SubnetCalculator() {
  const { t } = useLanguage();

  const [ipInput, setIpInput] = useState<string>('192.168.1.1');
  const [maskInput, setMaskInput] = useState<string>('24');
  const [result, setResult] = useState<SubnetResult | null>(null);
  const [error, setError] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [splitPrefix, setSplitPrefix] = useState<number>(25);

  // 计算
  const calculate = (ipStr: string = ipInput, maskStr: string = maskInput) => {
    setError('');
    setResult(null);
    setCopied(false);

    let ipPart = ipStr.trim();
    let maskPart = maskStr;

    if (ipPart.includes('/')) {
      const [ipOnly, cidr] = ipPart.split('/');
      ipPart = ipOnly;
      maskPart = cidr;
    }

    const ipInt = ipToInt(ipPart);
    if (ipInt === null) {
      setError(t('tools.subnet_calculator.errors.invalid_ip'));
      return;
    }

    if (!maskPart.trim()) {
      setError(t('tools.subnet_calculator.errors.mask_required'));
      return;
    }

    const prefix = parseMask(maskPart);
    if (prefix === null) {
      setError(t('tools.subnet_calculator.errors.invalid_mask'));
      return;
    }

    const r = computeSubnet(ipInt, prefix);
    setResult(r);
    setSplitPrefix(Math.min(prefix + 1, 32));
  };

  // 清空
  const handleClear = () => {
    setIpInput('');
    setMaskInput('');
    setResult(null);
    setError('');
    setCopied(false);
  };

  // 填入示例并计算
  const handleExample = () => {
    setIpInput('192.168.1.1');
    setMaskInput('24');
    calculate('192.168.1.1', '24');
  };

  // 复制结果
  const copyToClipboard = () => {
    if (!result) return;

    const lines: Array<[string, string]> = [
      [t('tools.subnet_calculator.results.cidr'), `${intToIp(result.network)}/${result.prefix}`],
      [t('tools.subnet_calculator.results.network_address'), intToIp(result.network)],
      [t('tools.subnet_calculator.results.broadcast_address'), intToIp(result.broadcast)],
      [t('tools.subnet_calculator.results.subnet_mask'), intToIp(result.mask)],
      [t('tools.subnet_calculator.results.wildcard_mask'), intToIp(4294967295 - result.mask)],
      [t('tools.subnet_calculator.results.host_range'), `${intToIp(result.firstHost)} - ${intToIp(result.lastHost)}`],
      [t('tools.subnet_calculator.results.usable_hosts'), result.usable.toLocaleString()],
    ];

    const text = `${t('tools.subnet_calculator.results.summary')}\n${lines
      .map(([label, value]) => `${label}: ${value}`)
      .join('\n')}`;

    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        console.error(t('tools.subnet_calculator.errors.copy_failed'));
      });
  };

  // 子网划分结果（派生）
  const splitInfo = useMemo(() => {
    if (!result || result.prefix >= 32) return null;
    const q = Math.min(Math.max(splitPrefix, result.prefix + 1), 32);
    const size = 2 ** (32 - q);
    const count = 2 ** (q - result.prefix);
    const limit = Math.min(count, MAX_SPLIT_ROWS);
    const list: SplitSubnet[] = [];
    for (let i = 0; i < limit; i++) {
      const network = result.network + i * size;
      const broadcast = network + size - 1;
      const usable = q <= 30 ? size - 2 : q === 31 ? 2 : 1;
      list.push({ network, broadcast, usable });
    }
    return { list, count, truncated: count > limit, prefix: q };
  }, [result, splitPrefix]);

  return (
    <div className="min-h-screen flex flex-col max-w-[1440px] mx-auto p-4 md:p-6">
      <ToolHeader
        icon={faNetworkWired}
        toolCode="subnet_calculator"
        title=""
        description=""
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <div className={styles.card}>
            <h2 className="text-lg font-medium text-primary mb-4">{t('tools.subnet_calculator.title')}</h2>

            <div className="mb-4">
              <label className={styles.label}>{t('tools.subnet_calculator.input_label')}</label>
              <input
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') calculate();
                }}
                placeholder={t('tools.subnet_calculator.input_placeholder')}
                className={`${styles.input} mt-2`}
              />
            </div>

            <div className="mb-6">
              <label className={styles.label}>{t('tools.subnet_calculator.mask_label')}</label>
              <input
                type="text"
                value={maskInput}
                onChange={(e) => setMaskInput(e.target.value.trim())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') calculate();
                }}
                placeholder={t('tools.subnet_calculator.mask_placeholder')}
                className={`${styles.input} mt-2`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button className={styles.primaryBtn} onClick={() => calculate()}>
                <FontAwesomeIcon icon={faCalculator} />
                {t('tools.subnet_calculator.calculate_button')}
              </button>
              <button className="btn-secondary" onClick={handleExample}>
                {t('tools.subnet_calculator.example_button')}
              </button>
              <button className="btn-secondary" onClick={handleClear}>
                {t('tools.subnet_calculator.clear_button')}
              </button>
            </div>

            {error && (
              <div className="mt-3 p-2 bg-red-900/20 border border-red-700/30 text-red-500 rounded-lg">
                {error}
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-primary font-medium mb-2">{t('tools.subnet_calculator.instruction_title')}</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-tertiary">
                <li>{t('tools.subnet_calculator.instructions.line1')}</li>
                <li>{t('tools.subnet_calculator.instructions.line2')}</li>
                <li>{t('tools.subnet_calculator.instructions.line3')}</li>
                <li>{t('tools.subnet_calculator.instructions.line4')}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className={styles.card}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-primary">{t('tools.subnet_calculator.results.title')}</h2>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="p-3 bg-block rounded-md border border-purple-glow/30">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-purple-glow/20">
                    <h3 className="text-primary font-mono font-semibold">
                      {intToIp(result.network)}/{result.prefix}
                    </h3>
                    <button
                      onClick={copyToClipboard}
                      className={styles.iconButton}
                      title={t('tools.subnet_calculator.copy')}
                    >
                      <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="ml-1" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.network_address')}:</span>
                      <span className={styles.resultValue}>{intToIp(result.network)}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.broadcast_address')}:</span>
                      <span className={styles.resultValue}>{intToIp(result.broadcast)}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.subnet_mask')}:</span>
                      <span className={styles.resultValue}>{intToIp(result.mask)}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.wildcard_mask')}:</span>
                      <span className={styles.resultValue}>{intToIp(4294967295 - result.mask)}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.ip_range')}:</span>
                      <span className={styles.resultValue}>{intToIp(result.network)} - {intToIp(result.broadcast)}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.host_range')}:</span>
                      <span className={styles.resultValue}>{intToIp(result.firstHost)} - {intToIp(result.lastHost)}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.total_addresses')}:</span>
                      <span className={styles.resultValue}>{result.total.toLocaleString()}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.usable_hosts')}:</span>
                      <span className={styles.resultValue}>{result.usable.toLocaleString()}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.ip_class')}:</span>
                      <span className={styles.resultValue}>{getClassLabel(result.network)}</span>
                    </div>
                    <div className={styles.resultItem}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.address_scope')}:</span>
                      <span className={styles.resultValue}>
                        {t(`tools.subnet_calculator.scopes.${getScopeKey(result.network)}`)}
                      </span>
                    </div>
                    <div className={`${styles.resultItem} md:col-span-2`}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.binary_mask')}:</span>
                      <span className={styles.resultValue}>{toBinaryDotted(result.mask)}</span>
                    </div>
                    <div className={`${styles.resultItem} md:col-span-2`}>
                      <span className={styles.resultLabel}>{t('tools.subnet_calculator.results.binary_network')}:</span>
                      <span className={styles.resultValue}>{toBinaryDotted(result.network)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 flex flex-col items-center justify-center text-tertiary">
                <FontAwesomeIcon icon={faNetworkWired} className="text-4xl mb-4 opacity-20" />
                <p>{t('tools.subnet_calculator.results.empty_state')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {result && splitInfo && (
        <div className={`${styles.card} mt-6`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-medium text-primary">{t('tools.subnet_calculator.split.title')}</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">{t('tools.subnet_calculator.split.prefix_label')}</span>
              <select
                value={splitInfo.prefix}
                onChange={(e) => setSplitPrefix(parseInt(e.target.value, 10))}
                className={styles.selectBox}
              >
                {Array.from({ length: 32 - result.prefix }, (_, i) => result.prefix + 1 + i).map((p) => (
                  <option key={p} value={p}>/{p}</option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-secondary mb-3">
            {t('tools.subnet_calculator.split.count_label').replace('{n}', splitInfo.count.toLocaleString())}
          </p>

          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-purple-glow/20 rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-block sticky top-0">
                <tr className="text-secondary text-left">
                  <th className="px-3 py-2 font-medium">{t('tools.subnet_calculator.split.col_index')}</th>
                  <th className="px-3 py-2 font-medium">{t('tools.subnet_calculator.split.col_network')}</th>
                  <th className="px-3 py-2 font-medium">{t('tools.subnet_calculator.split.col_range')}</th>
                  <th className="px-3 py-2 font-medium">{t('tools.subnet_calculator.split.col_broadcast')}</th>
                  <th className="px-3 py-2 font-medium">{t('tools.subnet_calculator.split.col_hosts')}</th>
                </tr>
              </thead>
              <tbody>
                {splitInfo.list.map((s, i) => (
                  <tr key={s.network} className="border-t border-purple-glow/10">
                    <td className="px-3 py-1.5 text-tertiary">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-primary">{intToIp(s.network)}/{splitInfo.prefix}</td>
                    <td className="px-3 py-1.5 font-mono text-primary">{intToIp(s.network)} - {intToIp(s.broadcast)}</td>
                    <td className="px-3 py-1.5 font-mono text-primary">{intToIp(s.broadcast)}</td>
                    <td className="px-3 py-1.5 font-mono text-primary">{s.usable.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {splitInfo.truncated && (
            <p className="mt-2 text-sm text-tertiary">
              {t('tools.subnet_calculator.split.truncated').replace('{n}', String(MAX_SPLIT_ROWS))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
