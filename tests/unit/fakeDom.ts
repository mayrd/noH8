import { vi } from 'vitest';
import type { UiDocument, UiWindow } from '../../src/content/ui/uiTypes';

/**
 * Structural DOM fake elements for testing UI modules in Node without jsdom.
 */
export class FakeEl {
  tag: string;
  children: FakeEl[] = [];
  handlers: Record<string, (event?: unknown) => void> = {};
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  textContent: string | null = null;
  value: string | null = null;
  removed = false;
  parent: FakeEl | null = null;

  /** Optional querySelector hook, set per-test when selector-based anchoring is exercised. */
  querySelector?: (selector: string) => FakeEl | null;

  constructor(tag: string) {
    this.tag = tag;
  }

  /** Mirrors the DOM `parentNode` property. */
  get parentNode(): FakeEl | null {
    return this.parent;
  }

  /** Mirrors the DOM `nextSibling` property. */
  get nextSibling(): FakeEl | null {
    const siblings = this.parent?.children ?? [];
    const idx = siblings.indexOf(this);
    return idx >= 0 && idx + 1 < siblings.length ? siblings[idx + 1] : null;
  }

  /** Mirrors `Node.insertBefore`: inserts `node` before `ref` (or appends when null). */
  insertBefore(node: FakeEl, ref: FakeEl | null): void {
    node.parent = this;
    if (ref === null) {
      this.children.push(node);
    } else {
      const idx = this.children.indexOf(ref);
      if (idx === -1) {
        this.children.push(node);
      } else {
        this.children.splice(idx, 0, node);
      }
    }
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }

  appendChild(node: FakeEl): void {
    node.parent = this;
    this.children.push(node);
  }

  addEventListener(type: string, listener: (event?: unknown) => void): void {
    this.handlers[type] = listener;
  }

  remove(): void {
    this.removed = true;
  }

  click(event?: unknown): void {
    this.handlers['click']?.(event);
  }

  private walk(fn: (el: FakeEl) => void): void {
    fn(this);
    for (const child of this.children) child.walk(fn);
  }

  findByData(marker: string): FakeEl | null {
    let found: FakeEl | null = null;
    this.walk((el) => {
      if (!found && el.dataset[marker] === 'true') found = el;
    });
    return found;
  }

  findButtons(): FakeEl[] {
    const buttons: FakeEl[] = [];
    this.walk((el) => {
      if (el.tag === 'button') buttons.push(el);
    });
    return buttons;
  }

  joinedText(): string {
    let out = this.textContent ?? '';
    for (const child of this.children) out += child.joinedText();
    return out;
  }
}

export function makeDoc(): UiDocument {
  return {
    body: new FakeEl('body') as unknown as UiDocument['body'],
    createElement: (tag: string) => new FakeEl(tag) as unknown as ReturnType<UiDocument['createElement']>,
  };
}

export function makeWindow(): UiWindow {
  return { open: vi.fn() };
}
