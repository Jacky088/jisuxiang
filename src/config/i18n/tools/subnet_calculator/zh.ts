export const subnetCalculatorZh = {
  title: '子网计算器',
  description: '计算IPv4子网的网络地址、广播地址、可用主机范围与子网划分',
  input_label: 'IP地址:',
  input_placeholder: '例如: 192.168.1.1 或 192.168.1.1/24',
  mask_label: '子网掩码:',
  mask_placeholder: '例如: 24 或 255.255.255.0',
  calculate_button: '计算',
  clear_button: '清空',
  example_button: '填入示例',
  copy: '复制',
  copied: '已复制',
  instruction_title: '使用说明:',
  instructions: {
    line1: 'IP地址支持 192.168.1.1 或 192.168.1.1/24 两种写法，含 / 时以 IP 中的前缀为准',
    line2: '子网掩码支持 CIDR 前缀（如 24）或点分十进制（如 255.255.255.0）',
    line3: '结果包含网络地址、广播地址、可用主机范围、可用主机数等信息',
    line4: '计算后可将当前网段继续划分为更小的子网'
  },
  results: {
    title: '计算结果',
    empty_state: '输入IP地址和子网掩码后点击"计算"按钮',
    summary: '子网计算结果',
    cidr: 'CIDR 表示',
    network_address: '网络地址',
    broadcast_address: '广播地址',
    subnet_mask: '子网掩码',
    wildcard_mask: '反掩码',
    ip_range: '地址范围',
    host_range: '可用主机范围',
    total_addresses: 'IP地址总数',
    usable_hosts: '可用主机数',
    ip_class: '地址类别',
    address_scope: '地址类型',
    binary_mask: '掩码二进制',
    binary_network: '网络地址二进制'
  },
  scopes: {
    private: '私有地址',
    public: '公网地址',
    loopback: '回环地址',
    link_local: '链路本地地址',
    multicast: '组播地址'
  },
  split: {
    title: '子网划分',
    prefix_label: '划分为:',
    count_label: '共划分为 {n} 个子网',
    truncated: '子网数量过多，仅显示前 {n} 条',
    col_index: '序号',
    col_network: '网络地址',
    col_range: '地址范围',
    col_broadcast: '广播地址',
    col_hosts: '可用主机'
  },
  errors: {
    invalid_ip: '无效的IP地址',
    invalid_mask: '无效的子网掩码，支持 0-32 前缀或点分十进制连续掩码',
    mask_required: '请输入子网掩码，或在IP地址中使用 /前缀 写法',
    copy_failed: '复制失败'
  }
};

export default subnetCalculatorZh;
