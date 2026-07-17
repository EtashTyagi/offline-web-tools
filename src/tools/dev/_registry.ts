import type { Tool } from '../../types/tool';
import jsonFormatter from './json-formatter';
import serializationConverter from './serialization-converter';
import pcapAnalyzer from './pcap-analyzer';
import packetFormatConverter from './packet-format-converter';
import ipAddressToolkit from './ip-address-toolkit';

export const tools: Tool[] = [
  jsonFormatter,
  serializationConverter,
  pcapAnalyzer,
  packetFormatConverter,
  ipAddressToolkit,
];
