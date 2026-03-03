import { z } from 'zod/v4';
import type { SystemMapSave } from '../types';

const CategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
});

const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const NodeDataSchema = z.object({
  title: z.string(),
  increases: z.array(z.string()).optional(),
  decreases: z.array(z.string()).optional(),
  category: z.string(),
});

const NodeSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  position: PositionSchema,
  data: NodeDataSchema,
}).passthrough();

const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
}).passthrough();

const ConfigSchema = z.object({
  blobsEnabled: z.boolean(),
  snapToGrid: z.boolean(),
  gridSize: z.number(),
  categories: z.array(CategorySchema),
});

const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

const SaveSchema = z.object({
  version: z.number(),
  config: ConfigSchema,
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  viewport: ViewportSchema.optional(),
});

export function serializeSave(save: SystemMapSave): string {
  return JSON.stringify(save, null, 2);
}

export function deserializeSave(json: string): SystemMapSave {
  const raw = JSON.parse(json);
  return SaveSchema.parse(raw) as unknown as SystemMapSave;
}

export function downloadJson(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function uploadJson(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}
