export const subnetCalculatorEn = {
  title: 'Subnet Calculator',
  description: 'Calculate IPv4 network address, broadcast address, usable host range and subnet division',
  input_label: 'IP Address:',
  input_placeholder: 'e.g. 192.168.1.1 or 192.168.1.1/24',
  mask_label: 'Subnet Mask:',
  mask_placeholder: 'e.g. 24 or 255.255.255.0',
  calculate_button: 'Calculate',
  clear_button: 'Clear',
  example_button: 'Example',
  copy: 'Copy',
  copied: 'Copied',
  instruction_title: 'Instructions:',
  instructions: {
    line1: 'IP address supports 192.168.1.1 or CIDR notation 192.168.1.1/24 (CIDR takes precedence)',
    line2: 'Subnet mask supports CIDR prefix (e.g. 24) or dotted decimal (e.g. 255.255.255.0)',
    line3: 'Results include network address, broadcast address, usable host range and host count',
    line4: 'After calculating, you can further divide the network into smaller subnets'
  },
  results: {
    title: 'Results',
    empty_state: 'Enter an IP address and subnet mask, then click "Calculate"',
    summary: 'Subnet Calculation Results',
    cidr: 'CIDR Notation',
    network_address: 'Network Address',
    broadcast_address: 'Broadcast Address',
    subnet_mask: 'Subnet Mask',
    wildcard_mask: 'Wildcard Mask',
    ip_range: 'Address Range',
    host_range: 'Usable Host Range',
    total_addresses: 'Total Addresses',
    usable_hosts: 'Usable Hosts',
    ip_class: 'Address Class',
    address_scope: 'Address Type',
    binary_mask: 'Mask (Binary)',
    binary_network: 'Network (Binary)'
  },
  scopes: {
    private: 'Private Address',
    public: 'Public Address',
    loopback: 'Loopback Address',
    link_local: 'Link-local Address',
    multicast: 'Multicast Address'
  },
  split: {
    title: 'Subnet Division',
    prefix_label: 'Divide into:',
    count_label: 'Divided into {n} subnets',
    truncated: 'Too many subnets, showing first {n} only',
    col_index: '#',
    col_network: 'Network Address',
    col_range: 'Address Range',
    col_broadcast: 'Broadcast',
    col_hosts: 'Usable Hosts'
  },
  errors: {
    invalid_ip: 'Invalid IP address',
    invalid_mask: 'Invalid subnet mask, use a 0-32 prefix or a contiguous dotted-decimal mask',
    mask_required: 'Enter a subnet mask, or use /prefix notation in the IP address',
    copy_failed: 'Copy failed'
  }
};

export default subnetCalculatorEn;
