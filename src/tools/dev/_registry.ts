import type { Tool } from '../../types/tool';
import jsonFormatter from './json-formatter';
import serializationConverter from './serialization-converter';
import pcapAnalyzer from './pcap-analyzer';
import tcpdumpConverter from './tcpdump-converter';

export const tools: Tool[] = [
  jsonFormatter,
  serializationConverter,
  pcapAnalyzer,
  tcpdumpConverter,
];
