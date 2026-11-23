import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const logicDir = join(import.meta.dirname, '..', 'src', 'logic');
const files = readdirSync(logicDir).filter((f) => f.endsWith('.js'));

describe('R1-R8: game rules are testable plain JS', () => {
  it('R1-R8: logic modules import no Three.js and touch no DOM', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(join(logicDir, f), 'utf8');
      expect(src, f).not.toMatch(/from\s+['"]three/);
      expect(src, f).not.toMatch(/\b(document|window)\./);
    }
  });
});
