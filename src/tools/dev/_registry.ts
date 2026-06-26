import type { Tool } from '../../types/tool';
import serializationConverter from './serialization-converter';
import pcapAnalyzer from './pcap-analyzer';
import tcpdumpConverter from './tcpdump-converter';

export const tools: Tool[] = [
  serializationConverter,
  pcapAnalyzer,
  tcpdumpConverter,
];
