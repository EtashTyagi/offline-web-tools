import type { Tool } from '../../../types/tool';

const tool: Tool = {
  id: 'serialization-converter',
  name: 'Serialization Converter',
  shortDescription: 'Convert between BSON, MessagePack, CBOR, JSON, Protobuf, Pickle, Java, and plist.',
  description:
    'Convert any supported serialization format to any other, entirely in your browser. Decode BSON, MessagePack, CBOR, JSON, Protobuf, Python Pickle, Java serialized objects, and Apple property lists, and re-encode into JSON, BSON, MessagePack, or CBOR. Paste hex or base64, or load a file. Nothing is uploaded.',
  category: 'dev',
  keywords: [
    'bson', 'protobuf', 'msgpack', 'messagepack', 'cbor', 'pickle', 'java serialization',
    'plist', 'binary decoder', 'deserialize', 'serialize', 'format converter',
  ],
  tags: [
    'bson to json', 'protobuf to json', 'pickle to json', 'msgpack to json',
    'cbor to json', 'java deserializer', 'binary format converter', 'serialization decoder',
  ],
  icon: '🔌',
  component: () => import('./SerializationConverter.tsx'),
  heavy: false,
  featured: false,
  status: 'beta',
  seo: {
    title: 'Serialization Converter — BSON, Protobuf, Pickle, CBOR',
    description:
      'Convert between BSON, MessagePack, CBOR, JSON, Protobuf, Python Pickle, Java serialized objects, and plist. Any format to any format. 100% in your browser.',
    keywords: ['bson to json', 'protobuf decoder', 'pickle converter', 'cbor decoder', 'msgpack to json'],
  },
};

export default tool;
