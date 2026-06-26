/// <reference lib="webworker" />
import { parsePcapFile, type PcapFileResult, type PcapPacket } from './pcap';

export interface ParseRequest {
  files: { name: string; bytes: Uint8Array }[];
}

export interface ParseResponse {
  results: PcapFileResult[];
}

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  const { files } = e.data;
  const results: PcapFileResult[] = files.map((f) => parsePcapFile(f.name, f.bytes));
  // The main thread only consumes layer metadata and lengths, never raw bytes,
  // so strip the per-packet byte buffers before posting to avoid a costly
  // structured clone of every captured byte.
  for (const r of results) {
    for (const p of r.packets) (p as PcapPacket).bytes = undefined;
  }
  const res: ParseResponse = { results };
  (self as unknown as Worker).postMessage(res);
};
