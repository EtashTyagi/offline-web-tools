import type { Tool } from '../../types/tool';
import jsonFormatter from './json-formatter';
import serializationConverter from './serialization-converter';
import pcapAnalyzer from './pcap-analyzer';
import packetFormatConverter from './packet-format-converter';
import ipAddressToolkit from './ip-address-toolkit';
import ipInspector from './ip-inspector';
import ipSubnetMembership from './ip-subnet-membership';
import subnetPlanner from './subnet-planner';
import ipConverter from './ip-converter';
import ipBatchValidator from './ip-batch-validator';
import ipSpecialRanges from './ip-special-ranges';

export const tools: Tool[] = [
  jsonFormatter,
  serializationConverter,
  pcapAnalyzer,
  packetFormatConverter,
  ipAddressToolkit,
  ipInspector,
  ipSubnetMembership,
  subnetPlanner,
  ipConverter,
  ipBatchValidator,
  ipSpecialRanges,
];
