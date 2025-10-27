/**
 * Fetches official Deepgram Voice Agent v1 API spec
 * Source: github.com/deepgram/deepgram-api-specs/asyncapi.yml
 * 
 * Run with: npx tsx tests/api-baseline/fetch-official-specs.ts
 */

import https from 'https';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SPECS_URL = 'https://raw.githubusercontent.com/deepgram/deepgram-api-specs/main/asyncapi.yml';

async function fetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchOfficialSpec() {
  console.log('📥 Fetching official Deepgram Voice Agent API spec...');
  
  const asyncApiYaml = await fetch(SPECS_URL);
  const spec = yaml.load(asyncApiYaml) as any;
  
  // Extract Voice Agent server events (messages from server to client)
  const serverEvents = extractServerEvents(spec);
  
  console.log(`✅ Found ${serverEvents.length} official Voice Agent events`);
  console.log('Events:', serverEvents.join(', '));
  
  // Generate TypeScript baseline
  generateBaselineFile(serverEvents);
  
  // Copy full spec for reference
  copyFullSpec(asyncApiYaml);
}

function extractServerEvents(spec: any): string[] {
  const events: string[] = [];
  const components = spec.components || {};
  const messages = components.messages || {};
  
  // Look for Agent-related server events (incoming from Deepgram)
  for (const [messageName, messageDef] of Object.entries(messages)) {
    const msg = messageDef as any;
    
    // Check if this is an Agent V1 message
    if (messageName.startsWith('AgentV1') && messageName.includes('Event')) {
      // Extract the message type constant
      if (msg.payload?.properties?.type?.const) {
        events.push(msg.payload.properties.type.const);
      }
    }
  }
  
  // Also check channels for Agent-specific messages
  const channels = spec.channels || {};
  for (const [channelPath, channel] of Object.entries(channels)) {
    if (channelPath.includes('AgentV1')) {
      const channelData = channel as any;
      if (channelData.messages) {
        for (const [msgKey, msgRef] of Object.entries(channelData.messages)) {
          if (typeof msgRef === 'object' && (msgRef as any).$ref) {
            const msgName = (msgRef as any).$ref.split('/').pop();
            if (msgName.includes('Event') && msgName.startsWith('AgentV1')) {
              // Extract from message definition
              const msgDef = messages[msgName];
              if (msgDef && (msgDef as any).payload?.properties?.type?.const) {
                const eventType = (msgDef as any).payload.properties.type.const;
                if (!events.includes(eventType)) {
                  events.push(eventType);
                }
              }
            }
          }
        }
      }
    }
  }
  
  return events.sort();
}

function generateBaselineFile(events: string[]) {
  const content = `/**
 * AUTO-GENERATED from github.com/deepgram/deepgram-api-specs
 * DO NOT EDIT MANUALLY
 * 
 * Official Deepgram Voice Agent v1 API server events
 * Source: https://github.com/deepgram/deepgram-api-specs/blob/main/asyncapi.yml
 * 
 * These are events sent FROM Deepgram server TO client
 */

export const OFFICIAL_DEEPGRAM_SERVER_EVENTS = [
${events.map(e => `  '${e}',`).join('\n')}
] as const;

export type OfficialDeepgramEvent = typeof OFFICIAL_DEEPGRAM_SERVER_EVENTS[number];
`;

  const outPath = path.join(__dirname, 'official-deepgram-api.ts');
  fs.writeFileSync(outPath, content);
  console.log(`✅ Generated baseline: ${outPath}`);
}

function copyFullSpec(yaml: string) {
  const outPath = path.join(__dirname, 'asyncapi.yml');
  fs.writeFileSync(outPath, yaml);
  console.log(`✅ Saved full spec: ${outPath}`);
}

fetchOfficialSpec().catch(console.error);

