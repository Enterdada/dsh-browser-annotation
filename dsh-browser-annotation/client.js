/**
 * dsh-browser-annotation — Client half.
 *
 * Desktop-only feature: annotate an element inside the built-in right-side
 * browser (Electron <webview>) and insert its exact locator + note into the
 * current chat draft through the composer's public InputActions face.
 *
 * The plugin registers exactly two Harness contributions:
 *   - sidebar.right.tab.menu.item  (session scope)   entry point
 *   - shell.overlay                (root scope)      failure notices
 *
 * It never registers Host services, tools, commands, routes or session events.
 */

window.__ModuleLoader__.load({
  id: 'dsh-browser-annotation',
  factory(require) {
    'use strict';

    const React = require('react');
    const h = React.createElement;
    const { useEffect, useState, useSyncExternalStore } = React;

    const NS = 'browserAnnotation';
    const GUEST_GLOBAL = '__DSH_BROWSER_ANNOTATION__';

    const POLL_INTERVAL = 120;
    const FIND_TIMEOUT = 1500;
    const SESSION_TIMEOUT = 5 * 60 * 1000;

    const CAP = {
      url: 600,
      selector: 500,
      xpath: 600,
      text: 200,
      outerHTML: 1200,
      source: 300,
      note: 2000,
      block: 4000,
    };

    const GUEST_CAPS = {
      url: 600,
      selector: 500,
      xpath: 600,
      text: 200,
      outerHTML: 1200,
      source: 300,
      note: 2000,
      attributes: 6,
      attributeList: 16,
      classes: 5,
      ancestors: 4,
    };

    const zh = {
      'menu.label': '批注模式',
      'menu.hint': '点选页面元素并加入对话',
      'input.button': '批注',
      'input.tooltip': '批注内置浏览器中的页面元素',
      'guest.hint': '批注模式：点击页面元素 · 点页面外退出 · Esc 取消',
      'guest.selected': '已选中',
      'guest.noNote': '请先填写批注内容或修改属性',
      'panel.title': '页面元素批注',
      'panel.note': '修改说明',
      'panel.placeholder': '描述要如何修改这个元素…',
      'panel.attributes': '元素属性',
      'panel.addAttribute': '添加属性',
      'panel.attributeName': '属性名',
      'panel.attributeValue': '值',
      'panel.removeAttribute': '删除属性',
      'panel.invalidAttribute': '属性名只能包含字母、数字、-、_、:、.',
      'panel.text': '文本内容',
      'panel.textPlaceholder': '元素文本内容（可选）',
      'panel.hint': '只记录修改，不会直接改页面',
      'panel.add': '加入对话框',
      'panel.addToList': '加入批注列表',
      'panel.adding': '正在加入…',
      'panel.cancel': '取消',
      'panel.close': '关闭',
      'panel.added': '已加入对话框批注块；返回对话即可编辑并发送。',
      'panel.addedToList': '已加入批注列表；可在输入框上方查看、编辑或加入对话。',
      'panel.addedText': '已加入对话框（文本）。',
      'panel.themeLight': '切换到浅色',
      'panel.themeDark': '切换到深色',
      'block.header': '[页面元素批注]',
      'block.page': '页面',
      'block.element': '元素',
      'block.selector': 'CSS 选择器',
      'block.xpath': 'XPath',
      'block.stable': '稳定属性',
      'block.source': '源码线索',
      'block.sourceNote': '（自动推断，可能不准确）',
      'block.text': '文本',
      'block.rect': '位置',
      'block.dom': 'DOM',
      'block.ancestors': '祖先',
      'block.attrChanges': '属性修改',
      'block.attrChanged': '修改',
      'block.attrAdded': '新增',
      'block.attrRemoved': '删除',
      'block.textChange': '文本修改',
      'block.note': '批注',
      'block.instruction':
        '说明: 该元素由用户在内置浏览器中直接点选，选择器与 DOM 来自页面实时数据；请据此定位源码并修改该元素，不要猜测。',
      'block.editsInstruction':
        '请按上面的属性修改/文本修改同步调整源码中该元素的属性与文本；选择器与 DOM 为当前页面数据。',
      'block.verified': '（唯一性已校验）',
      'block.unverified': '（唯一性未校验）',
      'chip.label': '页面元素批注',
      'chip.clipboard': '@页面元素批注',
      'dock.title': '页面批注',
      'dock.unit': '处',
      'dock.add': '加入对话框',
      'dock.added': '已加入对话框',
      'dock.reAdd': '重新加入',
      'dock.edit': '编辑',
      'dock.save': '保存',
      'dock.cancel': '取消',
      'dock.delete': '删除',
      'dock.clear': '清空',
      'dock.emptyNote': '（无说明）',
      'dock.hint': '修改后请重新加入对话框；旧批注块需手动删除。',
      'dock.changed': '批注已更新，当前对话框中的批注块可能已过期。',
      'dock.noAttribute': '无属性变更',
      'marker.title': '批注',
      'marker.note': '说明',
      'marker.noNote': '（无说明）',
      'marker.edit': '编辑',
      'marker.save': '保存',
      'marker.cancel': '取消',
      'marker.delete': '删除',
      'marker.close': '关闭',
      'marker.attributes': '属性变更',
      'card.title': '页面元素批注',
      'card.expand': '展开详情',
      'card.collapse': '收起详情',
      'card.summary': '包含 {n} 个元素批注',
      'toast.navigated': '页面已跳转，该页批注已清空。',
      'toast.busy': '上一个批注尚未结束，请稍候。',
      'toast.desktopOnly': '批注模式仅支持桌面版内置浏览器。',
      'toast.noWebview': '未找到可批注的页面：请先在右侧打开一个浏览器页面。',
      'toast.pageLoading': '页面正在加载，请稍后再试。',
      'toast.pageGone': '页面已跳转或关闭，批注已取消。',
      'toast.injectFailed': '无法在页面中启动批注模式，请刷新页面后重试。',
      'toast.cancelled': '已取消批注。',
      'toast.timeout': '批注模式超时，已退出。',
      'toast.draftChanged': '对话草稿正在变化，批注未能插入；内容仍在页面面板中，可重试。',
      'toast.invalidInfo': '未能读取该元素的定位信息，请重新选取。',
      'toast.chipFallback': '批注块插入失败，已改为文本插入。',
    };

    const en = {
      'menu.label': 'Annotate page element',
      'menu.hint': 'Pick a page element and add it to the chat',
      'input.button': 'Annotate',
      'input.tooltip': 'Annotate an element in the built-in side browser',
      'guest.hint': 'Annotation mode: click an element · click outside the page to exit · Esc cancels',
      'guest.selected': 'selected',
      'guest.noNote': 'Write a note or change an attribute first',
      'panel.title': 'Page element annotation',
      'panel.note': 'Describe the change',
      'panel.placeholder': 'Describe how this element should change…',
      'panel.attributes': 'Attributes',
      'panel.addAttribute': 'Add attribute',
      'panel.attributeName': 'Name',
      'panel.attributeValue': 'Value',
      'panel.removeAttribute': 'Remove attribute',
      'panel.invalidAttribute': 'Attribute names may contain letters, digits, -, _, :, and .',
      'panel.text': 'Text content',
      'panel.textPlaceholder': 'Element text (optional)',
      'panel.hint': 'Changes are recorded only; the page is not modified',
      'panel.add': 'Add to chat',
      'panel.addToList': 'Add to annotation list',
      'panel.adding': 'Adding…',
      'panel.cancel': 'Cancel',
      'panel.close': 'Close',
      'panel.added': 'Added as an annotation block; return to the chat to edit and send.',
      'panel.addedToList': 'Added to the annotation list; review or edit it above the composer.',
      'panel.addedText': 'Added to the chat as text.',
      'panel.themeLight': 'Switch to light',
      'panel.themeDark': 'Switch to dark',
      'block.header': '[Browser element annotation]',
      'block.page': 'Page',
      'block.element': 'Element',
      'block.selector': 'CSS selector',
      'block.xpath': 'XPath',
      'block.stable': 'Stable attributes',
      'block.source': 'Source hint',
      'block.sourceNote': '(inferred; may be inaccurate)',
      'block.text': 'Text',
      'block.rect': 'Rect',
      'block.dom': 'DOM',
      'block.ancestors': 'Ancestors',
      'block.attrChanges': 'Attribute changes',
      'block.attrChanged': 'Change',
      'block.attrAdded': 'Add',
      'block.attrRemoved': 'Remove',
      'block.textChange': 'Text change',
      'block.note': 'Annotation',
      'block.instruction':
        'Note: the user picked this element directly in the built-in browser; the selector and DOM come from the live page. Locate the source with them and change this exact element; do not guess.',
      'block.editsInstruction':
        'Apply the attribute and text changes above to this element in the source; the selector and DOM come from the live page.',
      'block.verified': ' (uniqueness verified)',
      'block.unverified': ' (uniqueness not verified)',
      'chip.label': 'Page element annotation',
      'chip.clipboard': '@element annotation',
      'dock.title': 'Page annotations',
      'dock.unit': 'items',
      'dock.add': 'Add to chat',
      'dock.added': 'Added to chat',
      'dock.reAdd': 'Add again',
      'dock.edit': 'Edit',
      'dock.save': 'Save',
      'dock.cancel': 'Cancel',
      'dock.delete': 'Delete',
      'dock.clear': 'Clear',
      'dock.emptyNote': '(no note)',
      'dock.hint': 'After editing, add again to chat; remove the previous annotation block manually.',
      'dock.changed': 'Annotations changed; the annotation block in the chat may be stale.',
      'dock.noAttribute': 'No attribute changes',
      'marker.title': 'Annotation',
      'marker.note': 'Note',
      'marker.noNote': '(no note)',
      'marker.edit': 'Edit',
      'marker.save': 'Save',
      'marker.cancel': 'Cancel',
      'marker.delete': 'Delete',
      'marker.close': 'Close',
      'marker.attributes': 'Attribute changes',
      'card.title': 'Page element annotation',
      'card.expand': 'Show details',
      'card.collapse': 'Hide details',
      'card.summary': 'Contains {n} element annotations',
      'toast.navigated': 'The page navigated; its annotations were cleared.',
      'toast.busy': 'The previous annotation is still active.',
      'toast.desktopOnly': 'Annotation mode requires the Desktop built-in browser.',
      'toast.noWebview': 'No annotatable page found. Open a page in the side browser first.',
      'toast.pageLoading': 'The page is still loading; try again in a moment.',
      'toast.pageGone': 'The page navigated or closed; the annotation was cancelled.',
      'toast.injectFailed': 'Could not start annotation mode in the page. Reload it and try again.',
      'toast.cancelled': 'Annotation cancelled.',
      'toast.timeout': 'Annotation mode timed out.',
      'toast.draftChanged': 'The draft changed, so the annotation was not inserted; it is still in the page panel.',
      'toast.invalidInfo': 'Could not read the element locator. Pick the element again.',
      'toast.chipFallback': 'The annotation block could not be inserted; it was added as text instead.',
    };

    // ---------------------------------------------------------------------
    // Small utilities
    // ---------------------------------------------------------------------

    function delay(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, ms);
      });
    }

    function withTimeout(promise, ms) {
      return new Promise(function (resolve, reject) {
        const timer = setTimeout(function () {
          reject(new Error('timeout'));
        }, ms);
        promise.then(
          function (value) {
            clearTimeout(timer);
            resolve(value);
          },
          function (error) {
            clearTimeout(timer);
            reject(error);
          },
        );
      });
    }

    function clampText(value, max) {
      const text = value === undefined || value === null ? '' : String(value);
      if (!max || text.length <= max) return text;
      return text.slice(0, Math.max(0, max - 1)) + '…';
    }

    function randomToken() {
      try {
        if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
          return globalThis.crypto.randomUUID();
        }
      } catch (error) {
        /* fall through */
      }
      return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    function isDesktopCarrier() {
      try {
        return Boolean(globalThis.dshDesktop && globalThis.dshDesktop.protocolVersion === 1);
      } catch (error) {
        return false;
      }
    }

    function isBrowserTab(tab) {
      return Boolean(tab && typeof tab.id === 'string' && tab.kind === 'browser');
    }

    function finiteNumber(value) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.round(number) : 0;
    }

    function createNoticeStore() {
      let snapshot = null;
      let seq = 0;
      const listeners = new Set();
      return {
        getSnapshot: function () {
          return snapshot;
        },
        subscribe: function (listener) {
          listeners.add(listener);
          return function () {
            listeners.delete(listener);
          };
        },
        push: function (message) {
          if (!message) return;
          seq += 1;
          snapshot = { id: seq, message: String(message) };
          listeners.forEach(function (listener) {
            listener();
          });
        },
        dismiss: function (id) {
          if (!snapshot || (id !== undefined && snapshot.id !== id)) return;
          snapshot = null;
          listeners.forEach(function (listener) {
            listener();
          });
        },
      };
    }

    function createAnnotationStore() {
      let state = { byTab: {} };
      const listeners = new Set();
      function emit() {
        listeners.forEach(function (listener) {
          listener();
        });
      }
      function read(tabId) {
        return state.byTab[tabId] || null;
      }
      function items(tabId) {
        const tab = read(tabId);
        return tab ? tab.items : [];
      }
      function mutate(tabId, updater) {
        const current = read(tabId) || { tabId: tabId, url: '', title: '', items: [] };
        const next = updater(current);
        const byTab = Object.assign({}, state.byTab);
        if (next.items.length === 0) delete byTab[tabId];
        else byTab[tabId] = next;
        state = { byTab: byTab };
        emit();
      }
      return {
        getSnapshot: function () {
          return state;
        },
        subscribe: function (listener) {
          listeners.add(listener);
          return function () {
            listeners.delete(listener);
          };
        },
        tab: read,
        items: items,
        add: function (tabId, item) {
          mutate(tabId, function (current) {
            return Object.assign({}, current, {
              url: (item.info && item.info.url) || current.url,
              title: (item.info && item.info.title) || current.title,
              items: current.items.concat([item]),
            });
          });
        },
        update: function (tabId, id, patch) {
          mutate(tabId, function (current) {
            return Object.assign({}, current, {
              items: current.items.map(function (item) {
                return item.id === id ? Object.assign({}, item, patch) : item;
              }),
            });
          });
        },
        remove: function (tabId, id) {
          mutate(tabId, function (current) {
            return Object.assign({}, current, {
              items: current.items.filter(function (item) {
                return item.id !== id;
              }),
            });
          });
        },
        clear: function (tabId) {
          if (!state.byTab[tabId]) return;
          const byTab = Object.assign({}, state.byTab);
          delete byTab[tabId];
          state = { byTab: byTab };
          emit();
        },
      };
    }

    const ANNO_START = '⟦DSH-BROWSER-ANNOTATION⟧';
    const ANNO_END = '⟦/DSH-BROWSER-ANNOTATION⟧';
    const MARKER_GLOBAL = '__DSH_BROWSER_ANNOTATIONS__';
    const annotations = createAnnotationStore();

    // ---------------------------------------------------------------------
    // Webview lookup (private DOM markers of the shipped side browser)
    // ---------------------------------------------------------------------

    function findWebviewForTab(tabId) {
      if (typeof tabId !== 'string' || tabId === '') return undefined;
      let nodes;
      try {
        nodes = Array.prototype.slice.call(
          document.querySelectorAll('webview[data-sidebar-browser-frame="webview"]'),
        );
      } catch (error) {
        return undefined;
      }
      const connected = nodes.filter(function (node) {
        return node && node.isConnected;
      });
      const scoped = connected.find(function (node) {
        let current = node.parentElement;
        let depth = 0;
        while (current && depth < 40) {
          const data = current.dataset || {};
          if (
            data.dockkitContent === tabId ||
            data.dockkitTab === tabId ||
            data.sidebarRightTab === tabId
          ) {
            return true;
          }
          current = current.parentElement;
          depth += 1;
        }
        return false;
      });
      if (scoped) return scoped;
      const visible = connected.filter(function (node) {
        try {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        } catch (error) {
          return false;
        }
      });
      return visible.length === 1 ? visible[0] : undefined;
    }

    function safeWebviewUrl(webview) {
      try {
        return typeof webview.getURL === 'function' ? String(webview.getURL() || '') : '';
      } catch (error) {
        return '';
      }
    }

    function visibleBrowserTabId() {
      let nodes;
      try {
        nodes = Array.prototype.slice.call(
          document.querySelectorAll('webview[data-sidebar-browser-frame="webview"]'),
        );
      } catch (error) {
        return undefined;
      }
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        if (!node || !node.isConnected) continue;
        try {
          const rect = node.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
        } catch (error) {
          continue;
        }
        let current = node.parentElement;
        let depth = 0;
        while (current && depth < 40) {
          const data = current.dataset || {};
          if (data.sidebarRightTab) return data.sidebarRightTab;
          current = current.parentElement;
          depth += 1;
        }
      }
      return undefined;
    }

    function findAnnotatableTab(sessionId, browserTabs) {
      const ctx = controller.ctx;
      try {
        const active = ctx && ctx.sidebarRight ? ctx.sidebarRight.active() : undefined;
        if (active && active.kind === 'browser' && typeof active.id === 'string') return active;
      } catch (error) {
        /* no on-screen surface */
      }
      const visibleId = visibleBrowserTabId();
      if (visibleId) {
        const record = (browserTabs || []).find(function (tab) {
          return tab && tab.tabId === visibleId;
        });
        if (record) return { id: record.tabId, kind: record.kind };
        return { id: visibleId, kind: 'browser' };
      }
      if (Array.isArray(browserTabs) && browserTabs.length > 0) {
        const last = browserTabs[browserTabs.length - 1];
        return { id: last.tabId, kind: last.kind };
      }
      return undefined;
    }

    function webviewIsLoading(webview) {
      try {
        return typeof webview.isLoading === 'function' ? webview.isLoading() === true : false;
      } catch (error) {
        return false;
      }
    }

    // ---------------------------------------------------------------------
    // Annotation block
    // ---------------------------------------------------------------------

    function normalizeInfo(raw) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const rect = source.rect && typeof source.rect === 'object' ? source.rect : {};
      const sourceHint =
        source.sourceHint && typeof source.sourceHint === 'object' ? source.sourceHint : null;
      const attributes = Array.isArray(source.attributes)
        ? source.attributes
            .slice(0, 6)
            .map(function (entry) {
              return {
                name: clampText(entry && entry.name, 60),
                value: clampText(entry && entry.value, 160),
              };
            })
            .filter(function (entry) {
              return entry.name !== '';
            })
        : [];
      const attributeList = Array.isArray(source.attributeList)
        ? source.attributeList
            .slice(0, 16)
            .map(function (entry) {
              return {
                name: clampText(entry && entry.name, 60),
                value: clampText(entry && entry.value, 300),
              };
            })
            .filter(function (entry) {
              return entry.name !== '';
            })
        : [];
      return {
        url: clampText(source.url, CAP.url),
        title: clampText(source.title, 200),
        selector: clampText(source.selector, CAP.selector),
        selectorUnique: source.selectorUnique === true,
        xpath: clampText(source.xpath, CAP.xpath),
        tag: clampText(source.tag, 40),
        id: clampText(source.id, 120),
        classes: Array.isArray(source.classes)
          ? source.classes.slice(0, 5).map(function (name) {
              return clampText(name, 80);
            })
          : [],
        attributes: attributes,
        attributeList: attributeList,
        text: clampText(source.text, CAP.text),
        outerHTML: clampText(source.outerHTML, CAP.outerHTML),
        rect: {
          x: finiteNumber(rect.x),
          y: finiteNumber(rect.y),
          width: finiteNumber(rect.width),
          height: finiteNumber(rect.height),
        },
        ancestors: Array.isArray(source.ancestors)
          ? source.ancestors.slice(0, 4).map(function (entry) {
              return clampText(entry, 120);
            })
          : [],
        sourceHint: sourceHint
          ? {
              kind: clampText(sourceHint.kind, 20),
              component: clampText(sourceHint.component, 120),
              file: clampText(sourceHint.file, CAP.source),
              line: finiteNumber(sourceHint.line),
              column: finiteNumber(sourceHint.column),
            }
          : null,
      };
    }

    function normalizeEdits(raw) {
      const source = raw && typeof raw === 'object' ? raw : {};
      const changed = Array.isArray(source.changed)
        ? source.changed
            .slice(0, 12)
            .map(function (entry) {
              return {
                name: clampText(entry && entry.name, 60),
                from: clampText(entry && entry.from, 300),
                to: clampText(entry && entry.to, 300),
              };
            })
            .filter(function (entry) {
              return entry.name !== '';
            })
        : [];
      const added = Array.isArray(source.added)
        ? source.added
            .slice(0, 12)
            .map(function (entry) {
              return {
                name: clampText(entry && entry.name, 60),
                value: clampText(entry && entry.value, 300),
              };
            })
            .filter(function (entry) {
              return entry.name !== '';
            })
        : [];
      const removed = Array.isArray(source.removed)
        ? source.removed
            .slice(0, 12)
            .map(function (entry) {
              return {
                name: clampText(entry && entry.name, 60),
                value: clampText(entry && entry.value, 300),
              };
            })
            .filter(function (entry) {
              return entry.name !== '';
            })
        : [];
      const text =
        source.text && typeof source.text === 'object'
          ? {
              from: clampText(source.text.from, CAP.text),
              to: clampText(source.text.to, CAP.text),
            }
          : null;
      return { changed: changed, added: added, removed: removed, text: text };
    }

    function hasEdits(edits) {
      return Boolean(
        edits &&
          (edits.changed.length > 0 ||
            edits.added.length > 0 ||
            edits.removed.length > 0 ||
            edits.text),
      );
    }

    function elementLabel(info) {
      let label = info.tag || 'element';
      if (info.id) label += '#' + info.id;
      if (info.classes.length > 0) label += '.' + info.classes.join('.');
      if (info.text) label += ' "' + clampText(info.text, 80) + '"';
      return label;
    }

    function sourceText(source) {
      const pieces = [];
      if (source.component) pieces.push(source.component);
      if (source.file) {
        pieces.push(source.file + (source.line ? ':' + source.line : ''));
      }
      return pieces.join(' · ');
    }

    function buildAnnotationBlock(info, note, edits, t) {
      const lines = [];
      const add = function (label, value) {
        if (value === undefined || value === null) return;
        const text = String(value).trim();
        if (text === '') return;
        lines.push(label + ': ' + text);
      };
      add(t('block.page'), info.url);
      add(t('block.element'), elementLabel(info));
      add(
        t('block.selector'),
        info.selector + (info.selectorUnique ? t('block.verified') : t('block.unverified')),
      );
      add(t('block.xpath'), info.xpath);
      if (info.attributes.length > 0) {
        add(
          t('block.stable'),
          info.attributes
            .map(function (entry) {
              return entry.name + '="' + entry.value + '"';
            })
            .join(', '),
        );
      }
      if (info.sourceHint && (info.sourceHint.component || info.sourceHint.file)) {
        add(t('block.source'), sourceText(info.sourceHint) + ' ' + t('block.sourceNote'));
      }
      if (info.text) add(t('block.text'), '"' + info.text + '"');
      if (info.rect.width || info.rect.height) {
        add(
          t('block.rect'),
          'x=' +
            info.rect.x +
            ' y=' +
            info.rect.y +
            ' w=' +
            info.rect.width +
            ' h=' +
            info.rect.height,
        );
      }
      if (!info.selectorUnique && info.ancestors.length > 0) {
        add(t('block.ancestors'), info.ancestors.join(' < '));
      }
      if (info.outerHTML) add(t('block.dom'), info.outerHTML);
      const attrEdits = edits
        ? edits.changed.length + edits.added.length + edits.removed.length
        : 0;
      if (attrEdits > 0) {
        lines.push(t('block.attrChanges') + ':');
        edits.changed.forEach(function (entry) {
          lines.push(
            '- ' +
              t('block.attrChanged') +
              ' ' +
              entry.name +
              ': "' +
              entry.from +
              '" → "' +
              entry.to +
              '"',
          );
        });
        edits.added.forEach(function (entry) {
          lines.push(
            '- ' + t('block.attrAdded') + ' ' + entry.name + '="' + entry.value + '"',
          );
        });
        edits.removed.forEach(function (entry) {
          lines.push(
            '- ' +
              t('block.attrRemoved') +
              ' ' +
              entry.name +
              (entry.value ? ' (was "' + entry.value + '")' : ''),
          );
        });
      }
      if (edits && edits.text) {
        add(t('block.textChange'), '"' + edits.text.from + '" → "' + edits.text.to + '"');
      }
      if (note) add(t('block.note'), note);
      lines.push(t('block.instruction'));
      if (hasEdits(edits)) lines.push(t('block.editsInstruction'));

      const prefix = t('block.header') + '\n';
      let block = prefix + lines.join('\n');
      if (block.length > CAP.block) block = block.slice(0, CAP.block - 1) + '…';
      return block;
    }

    function captureDraftSpan(actions) {
      try {
        if (!actions || typeof actions.captureInsertion !== 'function') return undefined;
        let span = actions.captureInsertion();
        if (!span) return undefined;
        if (
          typeof span.start === 'number' &&
          typeof span.end === 'number' &&
          span.start !== span.end
        ) {
          span = Object.assign({}, span, { start: span.end, end: span.end });
        }
        return span;
      } catch (error) {
        return undefined;
      }
    }

    function insertTextIntoDraft(actions, text) {
      try {
        if (!actions || typeof actions.insertText !== 'function') return false;
        const span = captureDraftSpan(actions);
        if (!span) return false;
        return actions.insertText('\n' + text + '\n', span) === true;
      } catch (error) {
        return false;
      }
    }

    const CHIP_SOURCE = 'browser-annotation';

    function chipElementLabel(info) {
      let label = info.tag || 'element';
      if (info.id) label += '#' + info.id;
      else if (info.classes.length > 0) label += '.' + info.classes[0];
      return label;
    }

    function buildChip(info, block, t) {
      const label = clampText(t('chip.label') + ' · ' + chipElementLabel(info), 80);
      const clipboard = clampText(t('chip.clipboard'), 40);
      const payload = {
        v: 1,
        block: block,
        label: label,
        clipboard: clipboard,
        url: info.url,
        selector: info.selector,
      };
      let ref;
      try {
        ref = JSON.stringify(payload);
      } catch (error) {
        ref = block;
      }
      return {
        source: CHIP_SOURCE,
        ref: ref,
        label: label,
        clipboardText: clipboard,
      };
    }

    function parseChipRef(ref) {
      try {
        const parsed = JSON.parse(String(ref));
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (error) {
        return null;
      }
    }

    function chipClipboardText(ref) {
      const payload = parseChipRef(ref);
      return payload && typeof payload.clipboard === 'string' && payload.clipboard
        ? payload.clipboard
        : '@annotation';
    }

    function chipSerializedBlock(ref) {
      const payload = parseChipRef(ref);
      return payload && typeof payload.block === 'string' && payload.block
        ? payload.block
        : String(ref);
    }

    function insertChipIntoDraft(actions, ctx, sessionId, chip) {
      try {
        if (!sessionId) return false;
        const conversation =
          ctx && typeof ctx.get === 'function' ? ctx.get('conversation') : undefined;
        const input = conversation && conversation.input;
        const shell =
          input && typeof input.shell === 'function' ? input.shell(sessionId) : undefined;
        if (!shell || typeof shell.insertReference !== 'function') return false;
        const span = captureDraftSpan(actions);
        if (!span) return false;
        return shell.insertReference(chip, span) === true;
      } catch (error) {
        return false;
      }
    }

    function diffSummary(edits, t) {
      if (!edits) return '';
      const parts = [];
      edits.changed.forEach(function (entry) {
        parts.push(entry.name);
      });
      edits.added.forEach(function (entry) {
        parts.push('+' + entry.name);
      });
      edits.removed.forEach(function (entry) {
        parts.push('-' + entry.name);
      });
      if (edits.text) parts.push(t('block.textChange'));
      return parts.join(' · ');
    }

    let markerManager = null;

    class MarkerManager {
      constructor(ctx, controller) {
        this.ctx = ctx;
        this.controller = controller;
        this.sessions = new Map();
        this.pending = new Set();
        this.disposed = false;
        this.syncing = false;
        this.unsubscribe = annotations.subscribe(() => this.syncAll());
      }

      t() {
        try {
          return this.ctx.locale.bind(NS);
        } catch (error) {
          return function (key) {
            return en[key] || key;
          };
        }
      }

      isOpen(tabId) {
        try {
          const list = this.ctx.sidebarRight.openTabs.getSnapshot();
          if (!Array.isArray(list)) return true;
          return list.some(function (tab) {
            return tab && tab.tabId === tabId;
          });
        } catch (error) {
          return true;
        }
      }

      syncAll() {
        if (this.disposed || this.syncing) return;
        this.syncing = true;
        try {
          const snapshot = annotations.getSnapshot();
          Object.keys(snapshot.byTab).forEach((tabId) => {
            if (!this.isOpen(tabId)) {
              annotations.clear(tabId);
              return;
            }
            this.ensure(tabId);
          });
          Array.from(this.sessions.keys()).forEach((tabId) => {
            if (!snapshot.byTab[tabId]) this.disposeTab(tabId);
          });
        } finally {
          this.syncing = false;
        }
      }

      async ensure(tabId) {
        if (this.disposed) return;
        const existing = this.sessions.get(tabId);
        if (existing) {
          if (existing.webview && existing.webview.isConnected) {
            this.push(tabId);
            return;
          }
          this.disposeTab(tabId);
        }
        if (!this.isOpen(tabId)) return;
        const webview = findWebviewForTab(tabId);
        if (!webview) return;
        if (webviewIsLoading(webview)) {
          if (!this.pending.has(tabId)) {
            this.pending.add(tabId);
            setTimeout(() => {
              this.pending.delete(tabId);
              this.ensure(tabId);
            }, 400);
          }
          return;
        }
        const token = randomToken();
        const t = this.t();
        const labels = {
          title: t('marker.title'),
          note: t('marker.note'),
          noNote: t('marker.noNote'),
          edit: t('marker.edit'),
          save: t('marker.save'),
          cancel: t('marker.cancel'),
          delete: t('marker.delete'),
          close: t('marker.close'),
          attributes: t('marker.attributes'),
        };
        const code =
          '(' +
          markerLayer.toString() +
          ')(' +
          JSON.stringify({ token: token, labels: labels }) +
          ');';
        let injected = null;
        try {
          injected = await withTimeout(webview.executeJavaScript(code), 6000);
        } catch (error) {
          injected = null;
        }
        if (this.disposed) return;
        if (!injected || injected.ok !== true) return;
        const session = { tabId: tabId, webview: webview, token: token, timer: null, listeners: [] };
        this.sessions.set(tabId, session);
        const add = (type, handler) => {
          try {
            webview.addEventListener(type, handler);
            session.listeners.push(function () {
              try {
                webview.removeEventListener(type, handler);
              } catch (error) {
                /* ignore */
              }
            });
          } catch (error) {
            /* ignore */
          }
        };
        add('did-navigate', (event) => {
          if (event && event.isMainFrame === false) return;
          annotations.clear(tabId);
          this.disposeTab(tabId);
          this.controller.notify(this.t()('toast.navigated'));
        });
        add('destroyed', () => {
          annotations.clear(tabId);
          this.disposeTab(tabId);
        });
        this.push(tabId);
        this.schedulePoll(session);
      }

      push(tabId) {
        if (this.disposed) return;
        const session = this.sessions.get(tabId);
        if (!session || !session.webview) return;
        const t = this.t();
        const items = annotations.items(tabId);
        const payload = items.map(function (item, index) {
          return {
            id: item.id,
            number: index + 1,
            selector: item.info.selector,
            rect: item.info.rect,
            label: chipElementLabel(item.info),
            note: item.note || '',
            diff: diffSummary(item.edits, t),
          };
        });
        const code =
          '(() => { const s = window.' +
          MARKER_GLOBAL +
          '; if (!s || s.token !== ' +
          JSON.stringify(session.token) +
          ') return false; s.setAnnotations(' +
          JSON.stringify(payload) +
          '); return true; })()';
        try {
          session.webview.executeJavaScript(code).catch(function () {
            /* ignore */
          });
        } catch (error) {
          /* ignore */
        }
      }

      schedulePoll(session) {
        if (this.disposed || !this.sessions.has(session.tabId)) return;
        session.timer = setTimeout(() => {
          session.timer = null;
          this.poll(session);
        }, 450);
      }

      async poll(session) {
        if (this.disposed || !this.sessions.has(session.tabId)) return;
        const token = JSON.stringify(session.token);
        const code =
          '(() => { const s = window.' +
          MARKER_GLOBAL +
          '; if (!s || s.token !== ' +
          token +
          ') return { missing: true }; s.lastContact = Date.now(); return { missing: false, events: s.events.splice(0) }; })()';
        let result;
        try {
          result = await session.webview.executeJavaScript(code);
        } catch (error) {
          result = null;
        }
        if (!this.sessions.has(session.tabId)) return;
        if (!result || result.missing) {
          annotations.clear(session.tabId);
          this.disposeTab(session.tabId);
          return;
        }
        const events = Array.isArray(result.events) ? result.events : [];
        if (events.length > 0) {
          events.forEach((event) => this.handleEvent(session.tabId, event));
          this.push(session.tabId);
        }
        this.schedulePoll(session);
      }

      handleEvent(tabId, event) {
        if (!event || typeof event.id !== 'string') return;
        const item = annotations.items(tabId).find(function (entry) {
          return entry.id === event.id;
        });
        if (!item) return;
        if (event.kind === 'delete') {
          annotations.remove(tabId, event.id);
          return;
        }
        if (event.kind === 'update') {
          const note = clampText(event.note, CAP.note).trim();
          annotations.update(tabId, event.id, {
            note: note,
            block: buildAnnotationBlock(item.info, note, item.edits, this.t()),
            updatedAt: Date.now(),
          });
        }
      }

      pause(tabId, paused) {
        const session = this.sessions.get(tabId);
        if (!session || !session.webview) return;
        try {
          session.webview
            .executeJavaScript(
              '(() => { const s = window.' +
                MARKER_GLOBAL +
                '; if (!s || s.token !== ' +
                JSON.stringify(session.token) +
                ') return false; s.setPaused(' +
                (paused ? 'true' : 'false') +
                '); return true; })()',
            )
            .catch(function () {
              /* ignore */
            });
        } catch (error) {
          /* ignore */
        }
      }

      disposeTab(tabId) {
        const session = this.sessions.get(tabId);
        if (!session) return;
        this.sessions.delete(tabId);
        if (session.timer) clearTimeout(session.timer);
        session.listeners.forEach(function (dispose) {
          try {
            dispose();
          } catch (error) {
            /* ignore */
          }
        });
        try {
          session.webview
            .executeJavaScript(
              '(() => { const s = window.' +
                MARKER_GLOBAL +
                '; if (!s || s.token !== ' +
                JSON.stringify(session.token) +
                ') return false; s.dispose(); return true; })()',
            )
            .catch(function () {
              /* ignore */
            });
        } catch (error) {
          /* ignore */
        }
      }

      dispose() {
        this.disposed = true;
        try {
          this.unsubscribe();
        } catch (error) {
          /* ignore */
        }
        Array.from(this.sessions.keys()).forEach((tabId) => this.disposeTab(tabId));
        this.sessions.clear();
      }
    }

    // ---------------------------------------------------------------------
    // Controller
    // ---------------------------------------------------------------------

    class AnnotationController {
      constructor(ctx) {
        this.ctx = ctx;
        this.notice = createNoticeStore();
        this.phase = 'idle';
        this.generation = 0;
        this.webview = null;
        this.listeners = [];
        this.pollTimer = null;
        this.expireTimer = null;
        this.token = null;
        this.actions = null;
        this.sessionId = null;
        this.tabId = null;
        this.outsideHandler = null;
        this.outsideKeyHandler = null;
        this.t = function (key) {
          return key;
        };
        this.disposed = false;
      }

      notify(message) {
        if (this.disposed || !message) return;
        this.notice.push(message);
      }

      guestLabels(t) {
        return {
          hint: t('guest.hint'),
          selected: t('guest.selected'),
          panelTitle: t('panel.title'),
          note: t('panel.note'),
          placeholder: t('panel.placeholder'),
          attributes: t('panel.attributes'),
          addAttribute: t('panel.addAttribute'),
          attributeName: t('panel.attributeName'),
          attributeValue: t('panel.attributeValue'),
          removeAttribute: t('panel.removeAttribute'),
          invalidAttribute: t('panel.invalidAttribute'),
          text: t('panel.text'),
          textPlaceholder: t('panel.textPlaceholder'),
          panelHint: t('panel.hint'),
          add: t('panel.addToList'),
          adding: t('panel.adding'),
          cancel: t('panel.cancel'),
          close: t('panel.close'),
          noNote: t('guest.noNote'),
          selectorPrefix: t('block.selector'),
          sourcePrefix: t('block.source'),
          sourceNote: t('block.sourceNote'),
          unverified: t('block.unverified'),
          added: t('panel.added'),
          themeLight: t('panel.themeLight'),
          themeDark: t('panel.themeDark'),
        };
      }

      async start(request) {
        const requestT = typeof request.t === 'function' ? request.t : this.t;
        if (this.disposed) return;
        if (!isDesktopCarrier()) {
          this.notify(requestT('toast.desktopOnly'));
          return;
        }
        if (!isBrowserTab(request.tab)) return;
        if (this.phase !== 'idle') {
          this.notify(requestT('toast.busy'));
          return;
        }
        const actions = request.inputActions;
        if (
          !actions ||
          typeof actions.captureInsertion !== 'function' ||
          typeof actions.insertText !== 'function'
        ) {
          this.notify(requestT('toast.desktopOnly'));
          return;
        }
        this.phase = 'starting';
        this.t = requestT;
        this.actions = actions;
        this.sessionId =
          typeof request.sessionId === 'string' && request.sessionId ? request.sessionId : null;
        const gen = ++this.generation;
        const tabId = request.tab.id;
        this.tabId = tabId;
        if (markerManager) markerManager.pause(tabId, true);
        try {
          // Make the annotated tab the active one so the page overlay is visible.
          this.ctx.sidebarRight.focus(tabId);
        } catch (error) {
          /* the pane may already be unmounting; waitForWebview retries */
        }
        try {
          const webview = await this.waitForWebview(tabId, gen);
          if (gen !== this.generation) return;
          if (!webview) {
            this.fail(gen, 'toast.noWebview');
            return;
          }
          const url = safeWebviewUrl(webview);
          if (!/^https?:/i.test(url)) {
            this.fail(gen, 'toast.noWebview');
            return;
          }
          if (typeof webview.executeJavaScript !== 'function') {
            this.fail(gen, 'toast.desktopOnly');
            return;
          }
          if (webviewIsLoading(webview)) {
            this.fail(gen, 'toast.pageLoading');
            return;
          }
          this.webview = webview;
          this.token = randomToken();
          this.attachListeners(webview, gen);
          const code =
            '(' +
            guestPicker.toString() +
            ')(' +
            JSON.stringify({ token: this.token, labels: this.guestLabels(requestT), caps: GUEST_CAPS }) +
            ');';
          let injected = null;
          try {
            injected = await withTimeout(webview.executeJavaScript(code), 6000);
          } catch (error) {
            injected = null;
          }
          if (gen !== this.generation) return;
          if (!injected || injected.ok !== true) {
            this.guestCall('dispose', []).catch(function () {
              /* the guest may not have started */
            });
            this.fail(gen, 'toast.injectFailed');
            return;
          }
          try {
            if (typeof webview.focus === 'function') webview.focus();
          } catch (error) {
            /* not fatal */
          }
          this.phase = 'picking';
          this.attachOutsideExit();
          this.expireTimer = setTimeout(() => {
            if (gen === this.generation) this.abort('toast.timeout');
          }, SESSION_TIMEOUT);
          this.schedulePoll(gen);
        } catch (error) {
          console.error('[dsh-browser-annotation] start failed', error);
          this.fail(gen, 'toast.injectFailed');
        }
      }

      async waitForWebview(tabId, gen) {
        const deadline = Date.now() + FIND_TIMEOUT;
        let focused = false;
        while (Date.now() <= deadline) {
          if (gen !== this.generation) return undefined;
          const found = findWebviewForTab(tabId);
          if (found) return found;
          if (!focused) {
            focused = true;
            try {
              this.ctx.sidebarRight.focus(tabId);
            } catch (error) {
              /* the tab may be in another session */
            }
          }
          await delay(100);
        }
        return findWebviewForTab(tabId);
      }

      attachListeners(webview, gen) {
        const abort = (event) => {
          if (event && event.isMainFrame === false) return;
          if (gen === this.generation) this.abort('toast.pageGone');
        };
        const add = (type, handler) => {
          try {
            webview.addEventListener(type, handler);
            this.listeners.push(function () {
              try {
                webview.removeEventListener(type, handler);
              } catch (error) {
                /* guest already gone */
              }
            });
          } catch (error) {
            /* unsupported event name */
          }
        };
        add('did-navigate', abort);
        add('did-start-navigation', abort);
        add('destroyed', abort);
        add('render-process-gone', abort);
      }

      detachListeners() {
        const pending = this.listeners;
        this.listeners = [];
        pending.forEach(function (dispose) {
          try {
            dispose();
          } catch (error) {
            /* ignore */
          }
        });
      }

      attachOutsideExit() {
        if (this.outsideHandler) return;
        this.outsideHandler = (event) => {
          if (this.phase !== 'picking' && this.phase !== 'selected') return;
          const target = event.target;
          try {
            if (
              target &&
              typeof target.closest === 'function' &&
              target.closest('[data-dsh-browser-annotation]')
            ) {
              return;
            }
          } catch (error) {
            /* ignore */
          }
          this.abort('');
        };
        this.outsideKeyHandler = (event) => {
          if (event.key !== 'Escape') return;
          if (this.phase !== 'picking' && this.phase !== 'selected') return;
          event.preventDefault();
          event.stopImmediatePropagation();
          this.abort('');
        };
        document.addEventListener('pointerdown', this.outsideHandler, true);
        document.addEventListener('keydown', this.outsideKeyHandler, true);
      }

      detachOutsideExit() {
        if (this.outsideHandler) {
          try {
            document.removeEventListener('pointerdown', this.outsideHandler, true);
          } catch (error) {
            /* ignore */
          }
          this.outsideHandler = null;
        }
        if (this.outsideKeyHandler) {
          try {
            document.removeEventListener('keydown', this.outsideKeyHandler, true);
          } catch (error) {
            /* ignore */
          }
          this.outsideKeyHandler = null;
        }
      }

      pollCode() {
        const token = JSON.stringify(this.token);
        return (
          '(() => { const s = window.' +
          GUEST_GLOBAL +
          '; if (!s || s.token !== ' +
          token +
          ') return { missing: true }; s.lastContact = Date.now(); return { missing: false, phase: s.phase, result: s.result }; })()'
        );
      }

      clearResultCode() {
        const token = JSON.stringify(this.token);
        return (
          '(() => { const s = window.' +
          GUEST_GLOBAL +
          '; if (!s || s.token !== ' +
          token +
          ') return false; s.result = null; s.lastContact = Date.now(); return true; })()'
        );
      }

      guestCall(name, args) {
        if (!this.webview || !this.token) return Promise.resolve(false);
        const serialized = (args || [])
          .map(function (value) {
            return JSON.stringify(value);
          })
          .join(', ');
        const code =
          '(() => { const s = window.' +
          GUEST_GLOBAL +
          '; if (!s || s.token !== ' +
          JSON.stringify(this.token) +
          ') return false; if (typeof s.' +
          name +
          ' !== "function") return false; s.' +
          name +
          '(' +
          serialized +
          '); return true; })()';
        try {
          return this.webview.executeJavaScript(code).catch(function () {
            return false;
          });
        } catch (error) {
          return Promise.resolve(false);
        }
      }

      schedulePoll(gen) {
        if (gen !== this.generation || this.phase !== 'picking') return;
        this.pollTimer = setTimeout(() => {
          this.pollTimer = null;
          this.poll(gen).catch(() => {
            if (gen === this.generation) this.abort('toast.pageGone');
          });
        }, POLL_INTERVAL);
      }

      async poll(gen) {
        if (gen !== this.generation || this.phase !== 'picking') return;
        const webview = this.webview;
        if (!webview) {
          this.abort('toast.pageGone');
          return;
        }
        let snapshot;
        try {
          snapshot = await webview.executeJavaScript(this.pollCode());
        } catch (error) {
          if (gen === this.generation) this.abort('toast.pageGone');
          return;
        }
        if (gen !== this.generation) return;
        if (!snapshot || snapshot.missing) {
          this.abort('toast.pageGone');
          return;
        }
        if (snapshot.result && typeof snapshot.result === 'object') {
          const result = snapshot.result;
          try {
            await webview.executeJavaScript(this.clearResultCode());
          } catch (error) {
            /* the guest will be disposed next */
          }
          if (gen !== this.generation) return;
          if (result.kind === 'cancel') {
            this.abort(result.silent ? '' : 'toast.cancelled');
            return;
          }
          if (result.kind === 'submit') {
            await this.commit(result, gen);
            if (gen !== this.generation) return;
          }
        }
        this.schedulePoll(gen);
      }

      async commit(result, gen) {
        const info = normalizeInfo(result.info);
        const edits = normalizeEdits(result.edits);
        const note = clampText(result.note, CAP.note).trim();
        if (!info.selector && !info.outerHTML) {
          const message = this.t('toast.invalidInfo');
          this.notify(message);
          await this.guestCall('finish', [false, message]);
          if (gen === this.generation) this.abort('');
          return;
        }
        if (!note && !hasEdits(edits)) {
          const message = this.t('toast.invalidInfo');
          this.notify(message);
          await this.guestCall('finish', [false, message]);
          return;
        }
        const tabId = this.tabId;
        if (!tabId) return;
        const id = randomToken();
        const block = buildAnnotationBlock(info, note, edits, this.t);
        try {
          annotations.add(tabId, {
            id: id,
            note: note,
            info: info,
            edits: edits,
            block: block,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        } catch (error) {
          console.error('[dsh-browser-annotation] store add failed', error);
          await this.guestCall('finish', [false, this.t('toast.invalidInfo')]);
          return;
        }
        if (markerManager) markerManager.pause(tabId, false);
        await this.guestCall('finish', [true, this.t('panel.addedToList')]);
        if (gen === this.generation) this.reset();
      }

      fail(gen, key) {
        if (gen !== this.generation) return;
        const message = this.t(key);
        this.reset();
        this.notify(message);
      }

      reset() {
        this.generation += 1;
        this.phase = 'idle';
        if (this.tabId && markerManager) markerManager.pause(this.tabId, false);
        this.tabId = null;
        this.detachListeners();
        this.detachOutsideExit();
        if (this.pollTimer) {
          clearTimeout(this.pollTimer);
          this.pollTimer = null;
        }
        if (this.expireTimer) {
          clearTimeout(this.expireTimer);
          this.expireTimer = null;
        }
        this.webview = null;
        this.token = null;
        this.actions = null;
        this.sessionId = null;
      }

      abort(key) {
        if (this.phase === 'idle') return;
        const message = key ? this.t(key) : '';
        this.guestCall('dispose', []).catch(function () {
          /* ignore */
        });
        this.reset();
        if (message) this.notify(message);
      }

      dispose() {
        this.disposed = true;
        if (this.phase !== 'idle') {
          this.guestCall('dispose', []).catch(function () {
            /* ignore */
          });
        }
        this.reset();
      }
    }

    // ---------------------------------------------------------------------
    // Guest picker (injected into the visited page; must stay self-contained)
    // ---------------------------------------------------------------------

    function guestPicker(opts) {
      'use strict';
      var GLOBAL = '__DSH_BROWSER_ANNOTATION__';
      var doc = document;
      var win = window;
      var labels = (opts && opts.labels) || {};
      var caps = (opts && opts.caps) || {};
      var token = opts && opts.token ? String(opts.token) : '';
      if (!token) return { ok: false, error: 'missing token' };

      var state;
      var disposed = false;
      var bound = [];
      var timers = [];
      var raf = 0;
      var watchdog = 0;
      var hovered = null;
      var selected = null;
      var info = null;
      var busy = false;
      var suppressUntil = 0;
      var scheme = 'light';
      var manualScheme = null;
      var attrRows = [];
      var host = null;
      var shadow = null;
      var hint = null;
      var box = null;
      var chipEl = null;
      var panel = null;
      var bodyEl = null;
      var titleEl = null;
      var subtitleEl = null;
      var selectorEl = null;
      var sourceEl = null;
      var noteEl = null;
      var textEl = null;
      var attrListEl = null;
      var addAttrBtn = null;
      var errorEl = null;
      var addBtn = null;
      var cancelBtn = null;
      var themeBtn = null;
      var closeBtn = null;

      var FONT =
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
      var MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

      var THEMES = {
        light: {
          '--anno-surface': 'rgba(255, 255, 255, 0.88)',
          '--anno-surface-solid': '#ffffff',
          '--anno-text': '#1d1d1f',
          '--anno-secondary': '#6e6e73',
          '--anno-tertiary': '#8e8e93',
          '--anno-border': 'rgba(60, 60, 67, 0.14)',
          '--anno-border-strong': 'rgba(60, 60, 67, 0.24)',
          '--anno-accent': '#0071e3',
          '--anno-accent-text': '#ffffff',
          '--anno-accent-soft': 'rgba(0, 113, 227, 0.12)',
          '--anno-danger': '#ff3b30',
          '--anno-success': '#34c759',
          '--anno-hover': 'rgba(120, 120, 128, 0.12)',
          '--anno-input': 'rgba(118, 118, 128, 0.08)',
          '--anno-focus': 'rgba(0, 113, 227, 0.24)',
          '--anno-shadow':
            '0 24px 64px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.06)',
          '--anno-blur': 'saturate(180%) blur(24px)',
        },
        dark: {
          '--anno-surface': 'rgba(28, 28, 30, 0.84)',
          '--anno-surface-solid': '#1c1c1e',
          '--anno-text': '#f5f5f7',
          '--anno-secondary': '#a1a1a6',
          '--anno-tertiary': '#8e8e93',
          '--anno-border': 'rgba(255, 255, 255, 0.14)',
          '--anno-border-strong': 'rgba(255, 255, 255, 0.24)',
          '--anno-accent': '#0a84ff',
          '--anno-accent-text': '#ffffff',
          '--anno-accent-soft': 'rgba(10, 132, 255, 0.2)',
          '--anno-danger': '#ff453a',
          '--anno-success': '#30d158',
          '--anno-hover': 'rgba(120, 120, 128, 0.24)',
          '--anno-input': 'rgba(120, 120, 128, 0.18)',
          '--anno-focus': 'rgba(10, 132, 255, 0.32)',
          '--anno-shadow':
            '0 24px 64px rgba(0, 0, 0, 0.52), 0 2px 8px rgba(0, 0, 0, 0.3)',
          '--anno-blur': 'saturate(180%) blur(24px)',
        },
      };

      function cap(value, max) {
        var text = value === undefined || value === null ? '' : String(value);
        if (!max || text.length <= max) return text;
        return text.slice(0, Math.max(0, max - 1)) + '…';
      }

      function setStyle(el, styles) {
        if (!el || !el.style) return el;
        for (var key in styles) {
          if (!Object.prototype.hasOwnProperty.call(styles, key)) continue;
          try {
            el.style.setProperty(key, styles[key], 'important');
          } catch (error) {
            /* ignore */
          }
        }
        return el;
      }

      function later(fn, ms) {
        var id = win.setTimeout(function () {
          timers = timers.filter(function (entry) {
            return entry !== id;
          });
          fn();
        }, ms);
        timers.push(id);
        return id;
      }

      function listen(target, type, handler, capture) {
        try {
          target.addEventListener(type, handler, !!capture);
          bound.push([target, type, handler, !!capture]);
        } catch (error) {
          /* ignore */
        }
      }

      function unlistenAll() {
        for (var index = 0; index < bound.length; index += 1) {
          try {
            bound[index][0].removeEventListener(bound[index][1], bound[index][2], bound[index][3]);
          } catch (error) {
            /* ignore */
          }
        }
        bound = [];
      }

      function inPanel(event) {
        try {
          var path = event.composedPath ? event.composedPath() : null;
          if (path && path.length) {
            for (var index = 0; index < path.length; index += 1) {
              if (path[index] === host) return true;
            }
          }
        } catch (error) {
          /* ignore */
        }
        try {
          return Boolean(host && event.target && host.contains && host.contains(event.target));
        } catch (error) {
          return false;
        }
      }

      function deepest(event) {
        var node = null;
        try {
          var path = event.composedPath ? event.composedPath() : null;
          if (path && path.length) node = path[0];
        } catch (error) {
          /* ignore */
        }
        if (!node) node = event.target;
        while (node && node.nodeType === 3) node = node.parentNode;
        if (!node || node.nodeType !== 1) return null;
        try {
          var root = node.getRootNode ? node.getRootNode() : null;
          if (root && root.host && root.host.nodeType === 1) node = root.host;
        } catch (error) {
          /* ignore */
        }
        return node;
      }

      function cssEscape(value) {
        try {
          if (win.CSS && typeof win.CSS.escape === 'function') return win.CSS.escape(String(value));
        } catch (error) {
          /* fall through */
        }
        return String(value).replace(/[^a-zA-Z0-9_\u00A0-\uFFFF-]/g, function (character) {
          return '\\' + character;
        });
      }

      function isUnique(selector, el) {
        try {
          var list = doc.querySelectorAll(selector);
          return list.length === 1 && list[0] === el;
        } catch (error) {
          return false;
        }
      }

      function selectorFor(el) {
        if (el === doc.documentElement) return { selector: 'html', unique: true };
        var parts = [];
        var node = el;
        var depth = 0;
        while (node && node.nodeType === 1 && depth < 8) {
          if (node.id) {
            var idSelector = '#' + cssEscape(node.id);
            if (isUnique(idSelector, node)) {
              parts.unshift(idSelector);
              node = null;
              break;
            }
          }
          var part = node.tagName ? node.tagName.toLowerCase() : '*';
          var classes = [];
          try {
            if (node.classList) {
              for (var cls = 0; cls < node.classList.length && classes.length < 2; cls += 1) {
                var name = node.classList[cls];
                if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) classes.push(cssEscape(name));
              }
            }
          } catch (error) {
            /* ignore */
          }
          if (classes.length > 0) part += '.' + classes.join('.');
          var parent = node.parentElement;
          if (parent) {
            var same = 0;
            var position = 0;
            var children = parent.children;
            for (var child = 0; child < children.length; child += 1) {
              if (children[child].tagName === node.tagName) {
                same += 1;
                if (children[child] === node) position = same;
              }
            }
            if (same > 1) part += ':nth-of-type(' + position + ')';
          }
          parts.unshift(part);
          node = parent;
          depth += 1;
        }
        var selector = parts.join(' > ');
        if (isUnique(selector, el)) return { selector: selector, unique: true };
        var fallback = [];
        var walker = el;
        var limit = 0;
        while (walker && walker.nodeType === 1 && limit < 12) {
          var segment = walker.tagName ? walker.tagName.toLowerCase() : '*';
          var holder = walker.parentElement;
          if (holder) {
            var index = 1;
            var sibling = walker;
            while ((sibling = sibling.previousElementSibling)) index += 1;
            segment += ':nth-child(' + index + ')';
          }
          fallback.unshift(segment);
          if (walker === doc.documentElement) break;
          walker = holder;
          limit += 1;
        }
        var longSelector = fallback.join(' > ');
        var longUnique = isUnique(longSelector, el);
        return {
          selector: longUnique || !selector ? longSelector : selector,
          unique: longUnique,
        };
      }

      function xpathFor(el) {
        var parts = [];
        var node = el;
        while (node && node.nodeType === 1) {
          var tag = node.tagName ? node.tagName.toLowerCase() : '*';
          var position = 1;
          var sibling = node;
          while ((sibling = sibling.previousElementSibling)) {
            if (sibling.tagName === node.tagName) position += 1;
          }
          parts.unshift(tag + '[' + position + ']');
          if (node === doc.documentElement) break;
          node = node.parentElement;
        }
        return '/' + parts.join('/');
      }

      function labelOf(el) {
        var label = el && el.tagName ? el.tagName.toLowerCase() : 'element';
        try {
          if (el.id) label += '#' + el.id;
          if (el.classList) {
            for (var index = 0; index < el.classList.length && index < 2; index += 1) {
              label += '.' + el.classList[index];
            }
          }
        } catch (error) {
          /* ignore */
        }
        return label;
      }

      function nameOf(fiber) {
        try {
          var type = fiber && (fiber.type || fiber.elementType);
          if (!type || typeof type === 'string') return '';
          return type.displayName || type.name || '';
        } catch (error) {
          return '';
        }
      }

      function sourceFor(el) {
        try {
          var keys = Object.getOwnPropertyNames(el);
          var fiberKey = null;
          for (var index = 0; index < keys.length; index += 1) {
            if (keys[index].indexOf('__reactFiber$') === 0) {
              fiberKey = keys[index];
              break;
            }
          }
          if (fiberKey) {
            var fiber = el[fiberKey];
            var depth = 0;
            var component = '';
            while (fiber && depth < 60) {
              var source = fiber._debugSource;
              if (source && source.fileName) {
                return {
                  kind: 'react',
                  component: nameOf(fiber) || component,
                  file: cap(source.fileName, caps.source || 300),
                  line: source.lineNumber || 0,
                  column: source.columnNumber || 0,
                };
              }
              if (!component) component = nameOf(fiber);
              fiber = fiber.return;
              depth += 1;
            }
            if (component) {
              return { kind: 'react', component: component, file: '', line: 0, column: 0 };
            }
          }
        } catch (error) {
          /* ignore */
        }
        try {
          var vue = el.__vueParentComponent;
          var vueDepth = 0;
          while (vue && vueDepth < 40) {
            var type = vue.type;
            if (type && (type.__file || type.__name)) {
              return {
                kind: 'vue',
                component: type.__name || type.name || '',
                file: cap(type.__file || '', caps.source || 300),
                line: 0,
                column: 0,
              };
            }
            vue = vue.parent;
            vueDepth += 1;
          }
        } catch (error) {
          /* ignore */
        }
        try {
          var attribute =
            el.getAttribute('data-source') ||
            el.getAttribute('data-inspector-file') ||
            el.getAttribute('data-source-file');
          if (attribute) {
            return {
              kind: 'attribute',
              component: '',
              file: cap(attribute, caps.source || 300),
              line: 0,
              column: 0,
            };
          }
        } catch (error) {
          /* ignore */
        }
        return null;
      }

      function collect(el) {
        var selectedSelector = selectorFor(el);
        var attributes = [];
        var names = [
          'data-testid',
          'data-test-id',
          'data-cy',
          'data-qa',
          'data-test',
          'name',
          'role',
          'aria-label',
          'type',
          'placeholder',
        ];
        for (var index = 0; index < names.length && attributes.length < (caps.attributes || 6); index += 1) {
          try {
            var value = el.getAttribute(names[index]);
            if (value) attributes.push({ name: names[index], value: cap(value, 160) });
          } catch (error) {
            /* ignore */
          }
        }
        var attributeList = [];
        try {
          for (
            var attrIndex = 0;
            attrIndex < el.attributes.length && attributeList.length < (caps.attributeList || 16);
            attrIndex += 1
          ) {
            var attr = el.attributes[attrIndex];
            attributeList.push({ name: cap(attr.name, 60), value: cap(attr.value, 300) });
          }
        } catch (error) {
          /* ignore */
        }
        var classes = [];
        try {
          if (el.classList) {
            for (var cls = 0; cls < el.classList.length && classes.length < (caps.classes || 5); cls += 1) {
              classes.push(cap(el.classList[cls], 80));
            }
          }
        } catch (error) {
          /* ignore */
        }
        var text = '';
        try {
          var raw = el.innerText != null ? el.innerText : el.textContent;
          text = cap(String(raw || '').replace(/\s+/g, ' ').trim(), caps.text || 200);
        } catch (error) {
          /* ignore */
        }
        var outerHTML = '';
        try {
          outerHTML = cap(String(el.outerHTML || '').replace(/\s+/g, ' ').trim(), caps.outerHTML || 1200);
        } catch (error) {
          /* ignore */
        }
        var rect = { x: 0, y: 0, width: 0, height: 0 };
        try {
          var boxRect = el.getBoundingClientRect();
          rect = {
            x: Math.round(boxRect.left),
            y: Math.round(boxRect.top),
            width: Math.round(boxRect.width),
            height: Math.round(boxRect.height),
          };
        } catch (error) {
          /* ignore */
        }
        var ancestors = [];
        try {
          var parent = el.parentElement;
          var depth = 0;
          while (parent && depth < (caps.ancestors || 4)) {
            ancestors.push(labelOf(parent));
            parent = parent.parentElement;
            depth += 1;
          }
        } catch (error) {
          /* ignore */
        }
        return {
          url: cap(location.href, caps.url || 600),
          title: cap(doc.title, 200),
          selector: cap(selectedSelector.selector, caps.selector || 500),
          selectorUnique: selectedSelector.unique === true,
          xpath: cap(xpathFor(el), caps.xpath || 600),
          tag: cap(el.tagName ? el.tagName.toLowerCase() : '', 40),
          id: cap(el.id || '', 120),
          classes: classes,
          attributes: attributes,
          attributeList: attributeList,
          text: text,
          outerHTML: outerHTML,
          rect: rect,
          ancestors: ancestors,
          sourceHint: sourceFor(el),
        };
      }

      function elementLabelText(value) {
        var label = value.tag || 'element';
        if (value.id) label += '#' + value.id;
        if (value.classes && value.classes.length > 0) label += '.' + value.classes.join('.');
        if (value.text) label += ' “' + cap(value.text, 70) + '”';
        return label;
      }

      function sourceLabel(value) {
        var pieces = [];
        if (value.component) pieces.push(value.component);
        if (value.file) pieces.push(value.file + (value.line ? ':' + value.line : ''));
        return pieces.join(' · ');
      }

      function parseLuminance(value) {
        var match = /rgba?\(([^)]+)\)/.exec(String(value || ''));
        if (!match) return null;
        var parts = match[1].split(',').map(function (item) {
          return parseFloat(item);
        });
        if (parts.length < 3) return null;
        var alpha = parts.length > 3 ? parts[3] : 1;
        if (!alpha) return null;
        if (isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
        return (0.299 * parts[0] + 0.587 * parts[1] + 0.114 * parts[2]) / 255;
      }

      function detectScheme() {
        var luminance = null;
        try {
          var nodes = [doc.body, doc.documentElement];
          for (var index = 0; index < nodes.length; index += 1) {
            if (!nodes[index]) continue;
            var value = parseLuminance(win.getComputedStyle(nodes[index]).backgroundColor);
            if (value !== null) {
              luminance = value;
              break;
            }
          }
        } catch (error) {
          /* ignore */
        }
        if (luminance !== null) return luminance < 0.45 ? 'dark' : 'light';
        try {
          return win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
        } catch (error) {
          return 'light';
        }
      }

      function applyScheme(next) {
        scheme = next === 'dark' ? 'dark' : 'light';
        var vars = THEMES[scheme];
        if (host) {
          for (var key in vars) {
            if (!Object.prototype.hasOwnProperty.call(vars, key)) continue;
            try {
              host.style.setProperty(key, vars[key], 'important');
            } catch (error) {
              /* ignore */
            }
          }
          try {
            host.style.setProperty('color-scheme', scheme, 'important');
          } catch (error) {
            /* ignore */
          }
        }
        if (themeBtn) {
          themeBtn.textContent = scheme === 'dark' ? '☀' : '☾';
          themeBtn.title = scheme === 'dark' ? labels.themeLight : labels.themeDark;
          themeBtn.setAttribute('aria-label', themeBtn.title);
        }
      }

      function schedulePaint() {
        if (raf || disposed) return;
        if (state.phase !== 'picking' && state.phase !== 'selected') return;
        raf = win.requestAnimationFrame(function () {
          raf = 0;
          paint();
        });
      }

      function hideBox() {
        if (box) box.style.setProperty('display', 'none', 'important');
        if (chipEl) chipEl.style.setProperty('display', 'none', 'important');
      }

      function paint() {
        if (disposed) return;
        if (state.phase !== 'picking' && state.phase !== 'selected') {
          hideBox();
          return;
        }
        var target = state.phase === 'picking' ? hovered : selected;
        if (!target || !target.isConnected) {
          hideBox();
          return;
        }
        var rect;
        try {
          rect = target.getBoundingClientRect();
        } catch (error) {
          hideBox();
          return;
        }
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          hideBox();
          return;
        }
        box.style.setProperty('display', 'block', 'important');
        setStyle(box, {
          left: rect.left + 'px',
          top: rect.top + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px',
          'border-style': state.phase === 'picking' ? 'solid' : 'dashed',
        });
        chipEl.style.setProperty('display', 'block', 'important');
        chipEl.textContent =
          state.phase === 'selected'
            ? (labels.selected || 'selected') + ' · ' + labelOf(target)
            : labelOf(target);
        var top = rect.top - 26;
        if (top < 4) top = Math.min(rect.bottom + 4, win.innerHeight - 24);
        chipEl.style.setProperty('top', top + 'px', 'important');
        chipEl.style.setProperty(
          'left',
          Math.max(4, Math.min(rect.left, win.innerWidth - 240)) + 'px',
          'important',
        );
        chipEl.style.setProperty(
          'max-width',
          Math.max(80, Math.min(win.innerWidth - 8, rect.width + 180)) + 'px',
          'important',
        );
      }

      function updateButtons() {
        if (!addBtn || !noteEl) return;
        addBtn.textContent = busy ? labels.adding || '…' : labels.add || 'Add';
        addBtn.disabled = busy || !hasContent();
        if (cancelBtn) cancelBtn.disabled = busy;
        if (noteEl) noteEl.disabled = busy;
        if (textEl) textEl.disabled = busy;
        attrRows.forEach(function (record) {
          record.nameEl.disabled = busy;
          record.valueEl.disabled = busy;
        });
      }

      function showHint() {
        if (!hint) return;
        hint.style.setProperty('display', 'inline-flex', 'important');
      }

      function hideHint() {
        if (!hint) return;
        hint.style.setProperty('display', 'none', 'important');
      }

      function toast(message) {
        if (!shadow || !message) return;
        var el = doc.createElement('div');
        setStyle(el, {
          position: 'fixed',
          left: '50%',
          bottom: '18px',
          transform: 'translateX(-50%)',
          background: 'var(--anno-surface)',
          color: 'var(--anno-text)',
          padding: '10px 14px',
          border: '1px solid var(--anno-border)',
          'border-radius': '12px',
          'box-shadow': 'var(--anno-shadow)',
          'backdrop-filter': 'var(--anno-blur)',
          '-webkit-backdrop-filter': 'var(--anno-blur)',
          'font-family': FONT,
          'font-size': '12px',
          'line-height': '1.5',
          'white-space': 'normal',
          'max-width': 'calc(100vw - 24px)',
          'pointer-events': 'none',
          'z-index': '2147483647',
          'text-align': 'center',
        });
        el.textContent = message;
        shadow.appendChild(el);
        later(function () {
          try {
            el.remove();
          } catch (error) {
            /* ignore */
          }
        }, 2600);
      }

      function clearResult() {
        state.result = null;
        state.lastContact = Date.now();
      }

      function readAttributeMap() {
        var map = {};
        attrRows.forEach(function (record) {
          var name = String(record.nameEl.value || '').trim();
          if (!name || !/^[A-Za-z_:][-A-Za-z0-9_:.]*$/.test(name)) return;
          map[name] = String(record.valueEl.value || '');
        });
        return map;
      }

      function invalidAttributeName() {
        for (var index = 0; index < attrRows.length; index += 1) {
          var name = String(attrRows[index].nameEl.value || '').trim();
          if (name && !/^[A-Za-z_:][-A-Za-z0-9_:.]*$/.test(name)) return name;
        }
        return '';
      }

      function currentEdits() {
        var original = {};
        var attributeList = (info && info.attributeList) || [];
        attributeList.forEach(function (attr) {
          original[attr.name] = attr.value;
        });
        var current = readAttributeMap();
        var changed = [];
        var added = [];
        var removed = [];
        Object.keys(current).forEach(function (name) {
          if (!Object.prototype.hasOwnProperty.call(original, name)) {
            added.push({ name: name, value: current[name] });
          } else if (String(original[name]) !== String(current[name])) {
            changed.push({ name: name, from: original[name], to: current[name] });
          }
        });
        Object.keys(original).forEach(function (name) {
          if (!Object.prototype.hasOwnProperty.call(current, name)) {
            removed.push({ name: name, value: original[name] });
          }
        });
        var beforeText = String((info && info.text) || '');
        var afterText = String(textEl ? textEl.value || '' : '').trim();
        var text = beforeText !== afterText ? { from: beforeText, to: afterText } : null;
        return { changed: changed, added: added, removed: removed, text: text };
      }

      function hasContent() {
        if (!info) return false;
        if (String(noteEl.value || '').trim() !== '') return true;
        var edits = currentEdits();
        return Boolean(
          edits.changed.length || edits.added.length || edits.removed.length || edits.text,
        );
      }

      function submit() {
        if (disposed || busy || !info) return;
        var invalid = invalidAttributeName();
        if (invalid) {
          errorEl.textContent = labels.invalidAttribute || '';
          return;
        }
        var note = cap(
          String(noteEl.value || '').replace(/\r\n/g, '\n').trim(),
          caps.note || 2000,
        );
        var edits = currentEdits();
        if (!note && !edits.changed.length && !edits.added.length && !edits.removed.length && !edits.text) {
          errorEl.textContent = labels.noNote || '';
          return;
        }
        busy = true;
        errorEl.textContent = '';
        updateButtons();
        state.result = { kind: 'submit', info: info, note: note, edits: edits };
      }

      function cancel(silent) {
        if (disposed || busy) return;
        state.phase = 'cancelled';
        state.result = { kind: 'cancel', silent: silent === true };
        if (panel) panel.style.setProperty('display', 'none', 'important');
        hideBox();
        hideHint();
        suppressUntil = Date.now() + 700;
        later(dispose, 5000);
      }

      function finish(ok, message) {
        if (disposed) return;
        if (ok) {
          busy = false;
          state.phase = 'done';
          if (panel) panel.style.setProperty('display', 'none', 'important');
          hideBox();
          hideHint();
          toast(message || labels.added || '');
          later(dispose, 1000);
          return;
        }
        busy = false;
        errorEl.textContent = message ? String(message) : '';
        updateButtons();
        try {
          noteEl.focus({ preventScroll: true });
        } catch (error) {
          /* ignore */
        }
      }

      function dispose() {
        if (disposed) return;
        disposed = true;
        try {
          if (watchdog) win.clearInterval(watchdog);
        } catch (error) {
          /* ignore */
        }
        try {
          if (raf) win.cancelAnimationFrame(raf);
        } catch (error) {
          /* ignore */
        }
        for (var index = 0; index < timers.length; index += 1) {
          try {
            win.clearTimeout(timers[index]);
          } catch (error) {
            /* ignore */
          }
        }
        timers = [];
        unlistenAll();
        try {
          if (host && host.parentNode) host.parentNode.removeChild(host);
        } catch (error) {
          /* ignore */
        }
        try {
          if (win[GLOBAL] && win[GLOBAL].token === token) delete win[GLOBAL];
        } catch (error) {
          /* ignore */
        }
      }

      function blockEvent(event) {
        if (disposed || inPanel(event)) return;
        if (state.phase !== 'picking' && Date.now() >= suppressUntil) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      }

      function stopAtHost(event) {
        try {
          event.stopPropagation();
        } catch (error) {
          /* ignore */
        }
      }

      function onPointerMove(event) {
        if (state.phase !== 'picking' || inPanel(event)) return;
        var target = deepest(event);
        if (!target || target === hovered) return;
        hovered = target;
        schedulePaint();
      }

      function onPointerDown(event) {
        if (disposed || inPanel(event)) return;
        if (typeof event.button === 'number' && event.button !== 0) return;
        if (event.isPrimary === false) return;
        if (state.phase === 'selected') {
          event.preventDefault();
          event.stopImmediatePropagation();
          cancel(true);
          return;
        }
        if (state.phase !== 'picking') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        var target = deepest(event);
        if (target) selectElement(target);
      }

      function blockKey(event) {
        if (disposed || inPanel(event)) return;
        if (event.key === 'Escape') {
          if (state.phase === 'picking' || state.phase === 'selected') {
            event.preventDefault();
            event.stopImmediatePropagation();
            cancel(true);
          }
          return;
        }
        if (state.phase === 'picking') {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }

      function onPanelKey(event) {
        if (!noteEl) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancel(true);
          return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          submit();
        }
      }

      function selectElement(el) {
        hovered = el;
        selected = el;
        state.phase = 'selected';
        suppressUntil = Date.now() + 700;
        paint();
        hideHint();
        openPanel();
      }

      function makeSectionLabel(text) {
        var el = doc.createElement('div');
        el.textContent = text || '';
        setStyle(el, {
          font: '600 11px/1.4 ' + FONT,
          'letter-spacing': '0.04em',
          color: 'var(--anno-secondary)',
          margin: '0 0 6px',
          'text-transform': 'none',
        });
        return el;
      }

      function makeInput(styles) {
        var el = doc.createElement('input');
        el.type = 'text';
        setStyle(el, styles);
        return el;
      }

      function bindInputFocus(input) {
        input.addEventListener('focus', function () {
          setStyle(input, {
            'border-color': 'var(--anno-accent)',
            'box-shadow': '0 0 0 3px var(--anno-focus)',
          });
        });
        input.addEventListener('blur', function () {
          setStyle(input, { 'border-color': 'var(--anno-border)', 'box-shadow': 'none' });
        });
      }

      function addAttributeRow(name, value, focusIt) {
        var row = doc.createElement('div');
        setStyle(row, { display: 'flex', gap: '6px', 'align-items': 'center', margin: '0 0 6px' });
        var nameInput = makeInput({
          flex: '0 0 38%',
          'min-width': '0',
          'box-sizing': 'border-box',
          background: 'var(--anno-input)',
          color: 'var(--anno-text)',
          border: '1px solid var(--anno-border)',
          'border-radius': '8px',
          padding: '6px 8px',
          font: '12px/1.4 ' + MONO,
          outline: 'none',
        });
        nameInput.placeholder = labels.attributeName || 'name';
        nameInput.value = name || '';
        nameInput.setAttribute('maxlength', '120');
        var valueInput = makeInput({
          flex: '1 1 auto',
          'min-width': '0',
          'box-sizing': 'border-box',
          background: 'var(--anno-input)',
          color: 'var(--anno-text)',
          border: '1px solid var(--anno-border)',
          'border-radius': '8px',
          padding: '6px 8px',
          font: '12px/1.4 ' + MONO,
          outline: 'none',
        });
        valueInput.placeholder = labels.attributeValue || 'value';
        valueInput.value = value || '';
        valueInput.setAttribute('maxlength', '300');
        var remove = doc.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.title = labels.removeAttribute || 'Remove';
        remove.setAttribute('aria-label', remove.title);
        setStyle(remove, {
          flex: 'none',
          width: '24px',
          height: '24px',
          border: 'none',
          'border-radius': '7px',
          background: 'transparent',
          color: 'var(--anno-secondary)',
          cursor: 'pointer',
          font: '15px/1 ' + FONT,
          padding: '0',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
        });
        var record = { row: row, nameEl: nameInput, valueEl: valueInput };
        remove.onclick = function () {
          var index = attrRows.indexOf(record);
          if (index >= 0) attrRows.splice(index, 1);
          try {
            row.remove();
          } catch (error) {
            /* ignore */
          }
          updateButtons();
        };
        nameInput.addEventListener('input', updateButtons);
        valueInput.addEventListener('input', updateButtons);
        bindInputFocus(nameInput);
        bindInputFocus(valueInput);
        row.appendChild(nameInput);
        row.appendChild(valueInput);
        row.appendChild(remove);
        attrListEl.appendChild(row);
        attrRows.push(record);
        updateButtons();
        if (focusIt) {
          try {
            nameInput.focus({ preventScroll: true });
          } catch (error) {
            /* ignore */
          }
        }
        return record;
      }

      function makeButton(text, kind) {
        var button = doc.createElement('button');
        button.type = 'button';
        button.textContent = text;
        var primary = kind === 'primary';
        setStyle(button, {
          height: '32px',
          padding: '0 14px',
          'border-radius': '10px',
          border: primary ? 'none' : '1px solid var(--anno-border)',
          background: primary ? 'var(--anno-accent)' : 'var(--anno-input)',
          color: primary ? 'var(--anno-accent-text)' : 'var(--anno-text)',
          font: '600 12px/1 ' + FONT,
          cursor: 'pointer',
          'white-space': 'nowrap',
          flex: 'none',
        });
        return button;
      }

      function makeIconButton(text) {
        var button = doc.createElement('button');
        button.type = 'button';
        button.textContent = text;
        setStyle(button, {
          width: '28px',
          height: '28px',
          border: 'none',
          'border-radius': '8px',
          background: 'transparent',
          color: 'var(--anno-secondary)',
          cursor: 'pointer',
          font: '15px/1 ' + FONT,
          padding: '0',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          flex: 'none',
        });
        return button;
      }

      function openPanel() {
        try {
          info = collect(selected);
        } catch (error) {
          info = null;
        }
        if (!info) {
          cancel(false);
          return;
        }
        state.info = info;
        subtitleEl.textContent = elementLabelText(info);
        selectorEl.textContent =
          (labels.selectorPrefix || 'Selector') +
          ': ' +
          info.selector +
          (info.selectorUnique ? '' : ' ' + (labels.unverified || ''));
        if (info.sourceHint && (info.sourceHint.file || info.sourceHint.component)) {
          sourceEl.textContent =
            (labels.sourcePrefix || 'Source') +
            ': ' +
            sourceLabel(info.sourceHint) +
            ' ' +
            (labels.sourceNote || '');
          sourceEl.style.setProperty('display', 'block', 'important');
        } else {
          sourceEl.style.setProperty('display', 'none', 'important');
          sourceEl.textContent = '';
        }
        noteEl.value = '';
        textEl.value = info.text || '';
        attrListEl.textContent = '';
        attrRows = [];
        (info.attributeList || []).forEach(function (attr) {
          addAttributeRow(attr.name, attr.value, false);
        });
        errorEl.textContent = '';
        busy = false;
        if (!manualScheme) applyScheme(detectScheme());
        updateButtons();
        panel.style.setProperty('display', 'flex', 'important');
        try {
          noteEl.focus({ preventScroll: true });
        } catch (error) {
          /* ignore */
        }
      }

      function build() {
        host = doc.createElement('div');
        setStyle(host, {
          all: 'initial',
          position: 'fixed',
          left: '0',
          top: '0',
          right: '0',
          bottom: '0',
          width: '100%',
          height: '100%',
          'z-index': '2147483646',
          'pointer-events': 'none',
          display: 'block',
          margin: '0',
          padding: '0',
          border: '0',
          background: 'transparent',
          overflow: 'visible',
          direction: 'ltr',
        });
        try {
          shadow = host.attachShadow({ mode: 'closed' });
        } catch (error) {
          shadow = host;
        }

        applyScheme(detectScheme());

        hint = doc.createElement('div');
        setStyle(hint, {
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'inline-flex',
          'align-items': 'center',
          gap: '8px',
          padding: '8px 12px',
          'border-radius': '999px',
          background: 'var(--anno-surface)',
          color: 'var(--anno-text)',
          border: '1px solid var(--anno-border)',
          'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.12)',
          'backdrop-filter': 'var(--anno-blur)',
          '-webkit-backdrop-filter': 'var(--anno-blur)',
          font: '500 12px/1.4 ' + FONT,
          'letter-spacing': '0.01em',
          'white-space': 'nowrap',
          'max-width': 'calc(100vw - 24px)',
          overflow: 'hidden',
          'pointer-events': 'none',
          'z-index': '2147483647',
        });
        var dot = doc.createElement('span');
        setStyle(dot, {
          width: '7px',
          height: '7px',
          'border-radius': '50%',
          background: 'var(--anno-accent)',
          flex: 'none',
        });
        hint.appendChild(dot);
        var hintText = doc.createElement('span');
        hintText.textContent = labels.hint || '';
        setStyle(hintText, { overflow: 'hidden', 'text-overflow': 'ellipsis' });
        hint.appendChild(hintText);
        var kbd = doc.createElement('span');
        kbd.textContent = 'Esc';
        setStyle(kbd, {
          background: 'var(--anno-input)',
          border: '1px solid var(--anno-border)',
          color: 'var(--anno-secondary)',
          'border-radius': '5px',
          padding: '1px 5px',
          font: '600 10px/1.4 ' + FONT,
          flex: 'none',
        });
        hint.appendChild(kbd);
        shadow.appendChild(hint);

        box = doc.createElement('div');
        setStyle(box, {
          position: 'fixed',
          display: 'none',
          border: '2px solid var(--anno-accent)',
          background: 'var(--anno-accent-soft)',
          'border-radius': '4px',
          'box-shadow': '0 0 0 1px rgba(0, 0, 0, 0.12)',
          'pointer-events': 'none',
          'z-index': '2147483646',
          'box-sizing': 'border-box',
        });
        shadow.appendChild(box);

        chipEl = doc.createElement('div');
        setStyle(chipEl, {
          position: 'fixed',
          display: 'none',
          background: 'var(--anno-accent)',
          color: 'var(--anno-accent-text)',
          padding: '3px 8px',
          'border-radius': '6px',
          font: '600 11px/1.4 ' + MONO,
          'white-space': 'nowrap',
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
          'pointer-events': 'none',
          'z-index': '2147483647',
          'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.18)',
        });
        shadow.appendChild(chipEl);

        panel = doc.createElement('div');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', labels.panelTitle || 'annotation');
        setStyle(panel, {
          position: 'fixed',
          left: '50%',
          bottom: '16px',
          transform: 'translateX(-50%)',
          width: 'min(460px, calc(100vw - 24px))',
          'max-height': 'min(78vh, 720px)',
          'box-sizing': 'border-box',
          display: 'none',
          'flex-direction': 'column',
          background: 'var(--anno-surface)',
          color: 'var(--anno-text)',
          border: '1px solid var(--anno-border)',
          'border-radius': '18px',
          'box-shadow': 'var(--anno-shadow)',
          'backdrop-filter': 'var(--anno-blur)',
          '-webkit-backdrop-filter': 'var(--anno-blur)',
          font: '13px/1.5 ' + FONT,
          '-webkit-font-smoothing': 'antialiased',
          'text-align': 'left',
          'pointer-events': 'auto',
          overflow: 'hidden',
          'z-index': '2147483647',
        });
        shadow.appendChild(panel);

        var header = doc.createElement('div');
        setStyle(header, {
          display: 'flex',
          'align-items': 'flex-start',
          gap: '10px',
          padding: '14px 16px 10px',
          flex: 'none',
        });
        var titleGroup = doc.createElement('div');
        setStyle(titleGroup, { flex: '1 1 auto', 'min-width': '0' });
        titleEl = doc.createElement('div');
        titleEl.textContent = labels.panelTitle || '';
        setStyle(titleEl, {
          font: '600 15px/1.3 ' + FONT,
          'letter-spacing': '-0.01em',
          color: 'var(--anno-text)',
        });
        titleGroup.appendChild(titleEl);
        subtitleEl = doc.createElement('div');
        setStyle(subtitleEl, {
          'font-size': '12px',
          'line-height': '1.4',
          color: 'var(--anno-secondary)',
          'margin-top': '2px',
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
          'white-space': 'nowrap',
        });
        titleGroup.appendChild(subtitleEl);
        header.appendChild(titleGroup);
        var headerActions = doc.createElement('div');
        setStyle(headerActions, { display: 'flex', gap: '4px', flex: 'none' });
        themeBtn = makeIconButton('☾');
        closeBtn = makeIconButton('×');
        closeBtn.setAttribute('aria-label', labels.close || 'Close');
        themeBtn.addEventListener('click', function () {
          manualScheme = scheme === 'dark' ? 'light' : 'dark';
          applyScheme(manualScheme);
        });
        closeBtn.addEventListener('click', function () {
          cancel(false);
        });
        headerActions.appendChild(themeBtn);
        headerActions.appendChild(closeBtn);
        header.appendChild(headerActions);
        panel.appendChild(header);

        bodyEl = doc.createElement('div');
        setStyle(bodyEl, {
          padding: '0 16px 4px',
          overflow: 'auto',
          flex: '1 1 auto',
          'min-height': '0',
          'overscroll-behavior': 'contain',
        });
        selectorEl = doc.createElement('div');
        setStyle(selectorEl, {
          font: '11px/1.5 ' + MONO,
          color: 'var(--anno-secondary)',
          background: 'var(--anno-input)',
          border: '1px solid var(--anno-border)',
          'border-radius': '8px',
          padding: '7px 9px',
          'word-break': 'break-all',
          'max-height': '50px',
          overflow: 'auto',
          margin: '0 0 14px',
        });
        bodyEl.appendChild(selectorEl);

        sourceEl = doc.createElement('div');
        setStyle(sourceEl, {
          font: '11px/1.5 ' + MONO,
          color: 'var(--anno-secondary)',
          'word-break': 'break-all',
          'max-height': '34px',
          overflow: 'auto',
          margin: '-8px 0 14px',
          display: 'none',
        });
        bodyEl.appendChild(sourceEl);

        var noteSection = doc.createElement('div');
        setStyle(noteSection, { margin: '0 0 14px' });
        noteSection.appendChild(makeSectionLabel(labels.note));
        noteEl = doc.createElement('textarea');
        noteEl.rows = 3;
        noteEl.placeholder = labels.placeholder || '';
        noteEl.setAttribute('maxlength', String(caps.note || 2000));
        setStyle(noteEl, {
          width: '100%',
          'box-sizing': 'border-box',
          'min-height': '74px',
          'max-height': '150px',
          resize: 'vertical',
          background: 'var(--anno-input)',
          color: 'var(--anno-text)',
          border: '1px solid var(--anno-border)',
          'border-radius': '10px',
          padding: '9px 10px',
          font: '13px/1.5 ' + FONT,
          outline: 'none',
        });
        bindInputFocus(noteEl);
        noteEl.addEventListener('input', updateButtons);
        noteEl.addEventListener('keydown', onPanelKey);
        noteSection.appendChild(noteEl);
        bodyEl.appendChild(noteSection);

        var attrSection = doc.createElement('div');
        setStyle(attrSection, { margin: '0 0 14px' });
        var attrHeader = doc.createElement('div');
        setStyle(attrHeader, {
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          gap: '8px',
          margin: '0 0 6px',
        });
        attrHeader.appendChild(makeSectionLabel(labels.attributes));
        addAttrBtn = doc.createElement('button');
        addAttrBtn.type = 'button';
        addAttrBtn.textContent = labels.addAttribute || 'Add';
        setStyle(addAttrBtn, {
          border: 'none',
          background: 'transparent',
          color: 'var(--anno-accent)',
          font: '600 12px/1.4 ' + FONT,
          cursor: 'pointer',
          padding: '0',
          'white-space': 'nowrap',
        });
        addAttrBtn.addEventListener('click', function () {
          addAttributeRow('', '', true);
        });
        attrHeader.appendChild(addAttrBtn);
        attrSection.appendChild(attrHeader);
        attrListEl = doc.createElement('div');
        attrSection.appendChild(attrListEl);
        bodyEl.appendChild(attrSection);

        var textSection = doc.createElement('div');
        setStyle(textSection, { margin: '0 0 6px' });
        textSection.appendChild(makeSectionLabel(labels.text));
        textEl = makeInput({
          width: '100%',
          'box-sizing': 'border-box',
          background: 'var(--anno-input)',
          color: 'var(--anno-text)',
          border: '1px solid var(--anno-border)',
          'border-radius': '9px',
          padding: '8px 10px',
          font: '12px/1.4 ' + FONT,
          outline: 'none',
        });
        textEl.placeholder = labels.textPlaceholder || '';
        textEl.setAttribute('maxlength', '400');
        bindInputFocus(textEl);
        textEl.addEventListener('input', updateButtons);
        textSection.appendChild(textEl);
        bodyEl.appendChild(textSection);

        errorEl = doc.createElement('div');
        setStyle(errorEl, {
          color: 'var(--anno-danger)',
          'font-size': '11px',
          'line-height': '1.5',
          'min-height': '0',
          margin: '6px 0 0',
          'white-space': 'pre-wrap',
        });
        bodyEl.appendChild(errorEl);
        panel.appendChild(bodyEl);

        var footer = doc.createElement('div');
        setStyle(footer, {
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          padding: '10px 16px 14px',
          'border-top': '1px solid var(--anno-border)',
          flex: 'none',
        });
        var footHint = doc.createElement('div');
        footHint.textContent = labels.panelHint || '';
        setStyle(footHint, {
          flex: '1 1 auto',
          'min-width': '0',
          color: 'var(--anno-secondary)',
          'font-size': '11px',
          'line-height': '1.4',
        });
        footer.appendChild(footHint);
        cancelBtn = makeButton(labels.cancel || 'Cancel', 'secondary');
        cancelBtn.addEventListener('click', function () {
          cancel(false);
        });
        addBtn = makeButton(labels.add || 'Add', 'primary');
        addBtn.addEventListener('click', submit);
        footer.appendChild(cancelBtn);
        footer.appendChild(addBtn);
        panel.appendChild(footer);
        panel.addEventListener('keydown', onPanelKey);

        try {
          doc.documentElement.appendChild(host);
        } catch (error) {
          doc.body.appendChild(host);
        }
        showHint();
      }

      function bind() {
        listen(doc, 'pointermove', onPointerMove, true);
        listen(doc, 'pointerdown', onPointerDown, true);
        listen(doc, 'mousedown', blockEvent, true);
        listen(doc, 'pointerup', blockEvent, true);
        listen(doc, 'mouseup', blockEvent, true);
        listen(doc, 'click', blockEvent, true);
        listen(doc, 'auxclick', blockEvent, true);
        listen(doc, 'contextmenu', blockEvent, true);
        listen(doc, 'dblclick', blockEvent, true);
        listen(doc, 'dragstart', blockEvent, true);
        listen(doc, 'scroll', schedulePaint, true);
        listen(win, 'resize', schedulePaint, true);
        listen(doc, 'keydown', blockKey, true);
        listen(doc, 'keypress', blockKey, true);
        listen(doc, 'keyup', blockKey, true);
        listen(host, 'keydown', stopAtHost, false);
        listen(host, 'keyup', stopAtHost, false);
        listen(host, 'keypress', stopAtHost, false);
        listen(host, 'pointerdown', stopAtHost, false);
        listen(host, 'mousedown', stopAtHost, false);
        listen(host, 'click', stopAtHost, false);
        listen(doc, 'pagehide', dispose, true);
        listen(win, 'beforeunload', dispose, true);
        watchdog = win.setInterval(function () {
          if (Date.now() - state.lastContact > 30000) dispose();
        }, 5000);
      }

      try {
        var stale = win[GLOBAL];
        if (stale && stale.token !== token && typeof stale.dispose === 'function') stale.dispose();
      } catch (error) {
        /* ignore */
      }

      state = {
        token: token,
        phase: 'picking',
        result: null,
        info: null,
        lastContact: Date.now(),
        dispose: dispose,
        clearResult: clearResult,
        finish: finish,
      };
      win[GLOBAL] = state;

      try {
        build();
        bind();
      } catch (error) {
        try {
          dispose();
        } catch (inner) {
          /* ignore */
        }
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
      return { ok: true };
    }

    function markerLayer(opts) {
      'use strict';
      var GLOBAL = '__DSH_BROWSER_ANNOTATIONS__';
      var doc = document;
      var win = window;
      var labels = (opts && opts.labels) || {};
      var token = opts && opts.token ? String(opts.token) : '';
      if (!token) return { ok: false, error: 'missing token' };

      var items = [];
      var badges = new Map();
      var paused = false;
      var disposed = false;
      var activeId = null;
      var editing = false;
      var raf = 0;
      var watchdog = 0;
      var host = null;
      var shadow = null;
      var popover = null;
      var popTitle = null;
      var popLabel = null;
      var popBody = null;
      var popNote = null;
      var popDiff = null;
      var popEdit = null;
      var popDelete = null;
      var popClose = null;
      var popSave = null;
      var popCancel = null;
      var textarea = null;
      var bound = [];
      var timers = [];

      var FONT =
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
      var MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

      var THEMES = {
        light: {
          '--anno-surface': 'rgba(255, 255, 255, 0.9)',
          '--anno-text': '#1d1d1f',
          '--anno-secondary': '#6e6e73',
          '--anno-border': 'rgba(60, 60, 67, 0.14)',
          '--anno-accent': '#0071e3',
          '--anno-accent-text': '#ffffff',
          '--anno-accent-soft': 'rgba(0, 113, 227, 0.12)',
          '--anno-danger': '#ff3b30',
          '--anno-hover': 'rgba(120, 120, 128, 0.12)',
          '--anno-input': 'rgba(118, 118, 128, 0.08)',
          '--anno-shadow':
            '0 24px 64px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.06)',
          '--anno-blur': 'saturate(180%) blur(24px)',
        },
        dark: {
          '--anno-surface': 'rgba(28, 28, 30, 0.86)',
          '--anno-text': '#f5f5f7',
          '--anno-secondary': '#a1a1a6',
          '--anno-border': 'rgba(255, 255, 255, 0.14)',
          '--anno-accent': '#0a84ff',
          '--anno-accent-text': '#ffffff',
          '--anno-accent-soft': 'rgba(10, 132, 255, 0.2)',
          '--anno-danger': '#ff453a',
          '--anno-hover': 'rgba(120, 120, 128, 0.24)',
          '--anno-input': 'rgba(120, 120, 128, 0.18)',
          '--anno-shadow':
            '0 24px 64px rgba(0, 0, 0, 0.52), 0 2px 8px rgba(0, 0, 0, 0.3)',
          '--anno-blur': 'saturate(180%) blur(24px)',
        },
      };

      function cap(value, max) {
        var text = value === undefined || value === null ? '' : String(value);
        if (!max || text.length <= max) return text;
        return text.slice(0, Math.max(0, max - 1)) + '…';
      }

      function setStyle(el, styles) {
        if (!el || !el.style) return el;
        for (var key in styles) {
          if (!Object.prototype.hasOwnProperty.call(styles, key)) continue;
          try {
            el.style.setProperty(key, styles[key], 'important');
          } catch (error) {
            /* ignore */
          }
        }
        return el;
      }

      function later(fn, ms) {
        var id = win.setTimeout(function () {
          timers = timers.filter(function (entry) {
            return entry !== id;
          });
          fn();
        }, ms);
        timers.push(id);
        return id;
      }

      function listen(target, type, handler, capture) {
        try {
          target.addEventListener(type, handler, !!capture);
          bound.push([target, type, handler, !!capture]);
        } catch (error) {
          /* ignore */
        }
      }

      function unlistenAll() {
        for (var index = 0; index < bound.length; index += 1) {
          try {
            bound[index][0].removeEventListener(bound[index][1], bound[index][2], bound[index][3]);
          } catch (error) {
            /* ignore */
          }
        }
        bound = [];
      }

      function inHost(event) {
        try {
          var path = event.composedPath ? event.composedPath() : null;
          if (path && path.length) {
            for (var index = 0; index < path.length; index += 1) {
              if (path[index] === host) return true;
            }
          }
        } catch (error) {
          /* ignore */
        }
        try {
          return Boolean(host && event.target && host.contains && host.contains(event.target));
        } catch (error) {
          return false;
        }
      }

      function parseLuminance(value) {
        var match = /rgba?\(([^)]+)\)/.exec(String(value || ''));
        if (!match) return null;
        var parts = match[1].split(',').map(function (item) {
          return parseFloat(item);
        });
        if (parts.length < 3) return null;
        var alpha = parts.length > 3 ? parts[3] : 1;
        if (!alpha) return null;
        if (isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return null;
        return (0.299 * parts[0] + 0.587 * parts[1] + 0.114 * parts[2]) / 255;
      }

      function detectScheme() {
        var luminance = null;
        try {
          var nodes = [doc.body, doc.documentElement];
          for (var index = 0; index < nodes.length; index += 1) {
            if (!nodes[index]) continue;
            var value = parseLuminance(win.getComputedStyle(nodes[index]).backgroundColor);
            if (value !== null) {
              luminance = value;
              break;
            }
          }
        } catch (error) {
          /* ignore */
        }
        if (luminance !== null) return luminance < 0.45 ? 'dark' : 'light';
        try {
          return win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
        } catch (error) {
          return 'light';
        }
      }

      function applyScheme(next) {
        var vars = THEMES[next === 'dark' ? 'dark' : 'light'];
        if (!host) return;
        for (var key in vars) {
          if (!Object.prototype.hasOwnProperty.call(vars, key)) continue;
          try {
            host.style.setProperty(key, vars[key], 'important');
          } catch (error) {
            /* ignore */
          }
        }
        try {
          host.style.setProperty('color-scheme', next === 'dark' ? 'dark' : 'light', 'important');
        } catch (error) {
          /* ignore */
        }
      }

      function resolveElement(item) {
        if (item._el && item._el.isConnected) return item._el;
        try {
          item._el = doc.querySelector(item.selector);
        } catch (error) {
          item._el = null;
        }
        return item._el;
      }

      function positionBadge(item) {
        var badge = badges.get(item.id);
        if (!badge) return;
        var el = resolveElement(item);
        var rect = null;
        if (el) {
          try {
            rect = el.getBoundingClientRect();
          } catch (error) {
            rect = null;
          }
        }
        if (!rect || (rect.width === 0 && rect.height === 0)) {
          badge.style.setProperty('display', 'none', 'important');
          return;
        }
        if (
          rect.bottom < 0 ||
          rect.top > win.innerHeight ||
          rect.right < 0 ||
          rect.left > win.innerWidth
        ) {
          badge.style.setProperty('display', 'none', 'important');
          return;
        }
        badge.style.setProperty('display', 'flex', 'important');
        var left = Math.max(4, Math.min(win.innerWidth - 30, rect.left + 4));
        var top = Math.max(4, Math.min(win.innerHeight - 30, rect.top - 10));
        badge.style.setProperty('left', left + 'px', 'important');
        badge.style.setProperty('top', top + 'px', 'important');
      }

      function reposition() {
        if (disposed || paused) return;
        items.forEach(positionBadge);
        if (activeId !== null && popover && popover.style.display !== 'none') {
          positionPopover();
        }
      }

      function scheduleReposition() {
        if (raf || disposed) return;
        raf = win.requestAnimationFrame(function () {
          raf = 0;
          reposition();
        });
      }

      function makeBadge(item) {
        var badge = doc.createElement('button');
        badge.type = 'button';
        badge.textContent = String(item.number);
        badge.title = (item.label || '') + (item.note ? ' · ' + cap(item.note, 80) : '');
        badge.setAttribute('aria-label', badge.title);
        setStyle(badge, {
          position: 'fixed',
          display: 'none',
          width: '22px',
          height: '22px',
          'min-width': '22px',
          'border-radius': '50%',
          border: '2px solid var(--anno-surface)',
          background: 'var(--anno-accent)',
          color: 'var(--anno-accent-text)',
          'box-shadow': '0 4px 14px rgba(0, 0, 0, 0.28)',
          font: '600 11px/1 ' + FONT,
          padding: '0',
          cursor: 'pointer',
          'align-items': 'center',
          'justify-content': 'center',
          'pointer-events': 'auto',
          'z-index': '2147483645',
          'transform-origin': 'center',
          transition: 'transform 120ms ease',
        });
        badge.addEventListener('pointerenter', function () {
          badge.style.setProperty('transform', 'scale(1.12)', 'important');
        });
        badge.addEventListener('pointerleave', function () {
          badge.style.setProperty('transform', 'scale(1)', 'important');
        });
        badge.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          openPopover(item.id);
        });
        shadow.appendChild(badge);
        return badge;
      }

      function renderMarkers() {
        badges.forEach(function (badge) {
          try {
            badge.remove();
          } catch (error) {
            /* ignore */
          }
        });
        badges.clear();
        if (paused || disposed) return;
        items.forEach(function (item) {
          var badge = makeBadge(item);
          badges.set(item.id, badge);
          positionBadge(item);
        });
      }

      function makeButton(text, kind) {
        var button = doc.createElement('button');
        button.type = 'button';
        button.textContent = text;
        var primary = kind === 'primary';
        var danger = kind === 'danger';
        setStyle(button, {
          height: '28px',
          padding: '0 11px',
          'border-radius': '8px',
          border: primary || danger ? 'none' : '1px solid var(--anno-border)',
          background: primary
            ? 'var(--anno-accent)'
            : danger
              ? 'var(--anno-danger)'
              : 'var(--anno-input)',
          color: primary || danger ? '#ffffff' : 'var(--anno-text)',
          font: '600 11px/1 ' + FONT,
          cursor: 'pointer',
          'white-space': 'nowrap',
          flex: 'none',
        });
        return button;
      }

      function iconButton(text, label) {
        var button = doc.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.title = label || '';
        button.setAttribute('aria-label', label || '');
        setStyle(button, {
          width: '24px',
          height: '24px',
          border: 'none',
          'border-radius': '7px',
          background: 'transparent',
          color: 'var(--anno-secondary)',
          font: '14px/1 ' + FONT,
          cursor: 'pointer',
          padding: '0',
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          flex: 'none',
        });
        return button;
      }

      function openPopover(id) {
        var item = items.find(function (entry) {
          return entry.id === id;
        });
        if (!item) return;
        activeId = id;
        editing = false;
        renderPopover(item);
        popover.style.setProperty('display', 'block', 'important');
        positionPopover();
        scheduleReposition();
      }

      function closePopover() {
        activeId = null;
        editing = false;
        if (popover) popover.style.setProperty('display', 'none', 'important');
      }

      function positionPopover() {
        if (activeId === null || !popover) return;
        var badge = badges.get(activeId);
        var rect = badge && badge.getBoundingClientRect ? badge.getBoundingClientRect() : null;
        var width = 320;
        var left = rect ? rect.right + 8 : 24;
        if (left + width > win.innerWidth - 12) left = rect ? Math.max(12, rect.left - width - 8) : 12;
        var top = rect ? rect.top : 24;
        if (top + 260 > win.innerHeight - 12) top = Math.max(12, win.innerHeight - 272);
        popover.style.setProperty('left', Math.max(8, left) + 'px', 'important');
        popover.style.setProperty('top', Math.max(8, top) + 'px', 'important');
      }

      function renderPopover(item) {
        if (!popover) return;
        popTitle.textContent = (labels.title || 'Annotation') + ' ' + item.number;
        popLabel.textContent = item.label || '';
        popBody.textContent = '';
        if (editing) {
          textarea = doc.createElement('textarea');
          textarea.value = item.note || '';
          textarea.placeholder = labels.note || '';
          textarea.rows = 3;
          textarea.setAttribute('maxlength', '2000');
          setStyle(textarea, {
            width: '100%',
            'box-sizing': 'border-box',
            'min-height': '64px',
            'max-height': '150px',
            resize: 'vertical',
            background: 'var(--anno-input)',
            color: 'var(--anno-text)',
            border: '1px solid var(--anno-border)',
            'border-radius': '8px',
            padding: '7px 8px',
            font: '12px/1.5 ' + FONT,
            outline: 'none',
            margin: '0 0 8px',
          });
          popBody.appendChild(textarea);
        } else {
          var note = doc.createElement('div');
          note.textContent = item.note || labels.noNote || '';
          setStyle(note, {
            color: item.note ? 'var(--anno-text)' : 'var(--anno-secondary)',
            'font-size': '12px',
            'line-height': '1.5',
            'white-space': 'pre-wrap',
            'word-break': 'break-word',
            margin: '0 0 6px',
            'max-height': '120px',
            overflow: 'auto',
          });
          popBody.appendChild(note);
        }
        if (item.diff) {
          popDiff.textContent = (labels.attributes || '') + ': ' + item.diff;
          popDiff.style.setProperty('display', 'block', 'important');
        } else {
          popDiff.textContent = '';
          popDiff.style.setProperty('display', 'none', 'important');
        }
        popEdit.style.setProperty('display', editing ? 'none' : 'inline-flex', 'important');
        popDelete.style.setProperty('display', editing ? 'none' : 'inline-flex', 'important');
        popSave.style.setProperty('display', editing ? 'inline-flex' : 'none', 'important');
        popCancel.style.setProperty('display', editing ? 'inline-flex' : 'none', 'important');
        if (editing && textarea) {
          later(function () {
            try {
              textarea.focus({ preventScroll: true });
            } catch (error) {
              /* ignore */
            }
          }, 20);
        }
      }

      function saveEdit() {
        if (activeId === null || !textarea) return;
        var item = items.find(function (entry) {
          return entry.id === activeId;
        });
        if (!item) return;
        var note = cap(String(textarea.value || '').trim(), 2000);
        item.note = note;
        var event = { kind: 'update', id: item.id, note: note };
        state.events.push(event);
        if (state.events.length > 30) state.events.splice(0, state.events.length - 30);
        editing = false;
        renderPopover(item);
        scheduleReposition();
      }

      function deleteItem() {
        if (activeId === null) return;
        var id = activeId;
        var item = items.find(function (entry) {
          return entry.id === id;
        });
        if (!item) return;
        state.events.push({ kind: 'delete', id: id });
        if (state.events.length > 30) state.events.splice(0, state.events.length - 30);
        items = items.filter(function (entry) {
          return entry.id !== id;
        });
        var badge = badges.get(id);
        if (badge) {
          try {
            badge.remove();
          } catch (error) {
            /* ignore */
          }
          badges.delete(id);
        }
        closePopover();
      }

      function setAnnotations(list) {
        if (disposed) return;
        var previous = new Map();
        items.forEach(function (item) {
          previous.set(item.id, item);
        });
        items = Array.isArray(list)
          ? list.map(function (entry) {
              var previousItem = previous.get(entry && entry.id);
              return {
                id: entry.id,
                number: entry.number,
                selector: entry.selector,
                rect: entry.rect,
                label: entry.label,
                note: entry.note,
                diff: entry.diff,
                _el: previousItem ? previousItem._el : undefined,
              };
            })
          : [];
        state.lastContact = Date.now();
        if (activeId !== null && !items.some(function (item) { return item.id === activeId; })) {
          closePopover();
        }
        renderMarkers();
        if (activeId !== null) {
          var active = items.find(function (item) { return item.id === activeId; });
          if (active) {
            renderPopover(active);
            positionPopover();
          }
        }
      }

      function setPaused(next) {
        paused = next === true;
        if (paused) {
          closePopover();
          if (host) host.style.setProperty('display', 'none', 'important');
          return;
        }
        if (host) host.style.setProperty('display', 'block', 'important');
        renderMarkers();
        scheduleReposition();
      }

      function dispose() {
        if (disposed) return;
        disposed = true;
        try {
          if (watchdog) win.clearInterval(watchdog);
        } catch (error) {
          /* ignore */
        }
        try {
          if (raf) win.cancelAnimationFrame(raf);
        } catch (error) {
          /* ignore */
        }
        for (var index = 0; index < timers.length; index += 1) {
          try {
            win.clearTimeout(timers[index]);
          } catch (error) {
            /* ignore */
          }
        }
        timers = [];
        unlistenAll();
        try {
          if (host && host.parentNode) host.parentNode.removeChild(host);
        } catch (error) {
          /* ignore */
        }
        try {
          if (win[GLOBAL] && win[GLOBAL].token === token) delete win[GLOBAL];
        } catch (error) {
          /* ignore */
        }
      }

      function onOutsidePointer(event) {
        if (disposed || paused) return;
        if (activeId === null) return;
        if (inHost(event)) return;
        closePopover();
      }

      function onKey(event) {
        if (disposed) return;
        if (event.key !== 'Escape') return;
        if (activeId === null) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        closePopover();
      }

      function stopAtHost(event) {
        try {
          event.stopPropagation();
        } catch (error) {
          /* ignore */
        }
      }

      function build() {
        host = doc.createElement('div');
        setStyle(host, {
          all: 'initial',
          position: 'fixed',
          left: '0',
          top: '0',
          right: '0',
          bottom: '0',
          width: '100%',
          height: '100%',
          'z-index': '2147483645',
          'pointer-events': 'none',
          display: 'block',
          margin: '0',
          padding: '0',
          border: '0',
          background: 'transparent',
          overflow: 'visible',
          direction: 'ltr',
        });
        try {
          shadow = host.attachShadow({ mode: 'closed' });
        } catch (error) {
          shadow = host;
        }
        applyScheme(detectScheme());

        popover = doc.createElement('div');
        popover.setAttribute('role', 'dialog');
        setStyle(popover, {
          position: 'fixed',
          display: 'none',
          width: '320px',
          'max-height': '60vh',
          'box-sizing': 'border-box',
          background: 'var(--anno-surface)',
          color: 'var(--anno-text)',
          border: '1px solid var(--anno-border)',
          'border-radius': '14px',
          'box-shadow': 'var(--anno-shadow)',
          'backdrop-filter': 'var(--anno-blur)',
          '-webkit-backdrop-filter': 'var(--anno-blur)',
          font: '12px/1.5 ' + FONT,
          '-webkit-font-smoothing': 'antialiased',
          padding: '12px',
          'pointer-events': 'auto',
          overflow: 'auto',
          'z-index': '2147483647',
        });
        var header = doc.createElement('div');
        setStyle(header, {
          display: 'flex',
          'align-items': 'center',
          gap: '8px',
          margin: '0 0 8px',
        });
        popTitle = doc.createElement('div');
        setStyle(popTitle, { font: '600 13px/1.3 ' + FONT, flex: '1 1 auto' });
        popLabel = doc.createElement('div');
        setStyle(popLabel, {
          color: 'var(--anno-secondary)',
          font: '11px/1.3 ' + MONO,
          'max-width': '150px',
          overflow: 'hidden',
          'text-overflow': 'ellipsis',
          'white-space': 'nowrap',
          flex: '0 1 auto',
        });
        popClose = iconButton('×', labels.close || 'Close');
        popClose.addEventListener('click', closePopover);
        header.appendChild(popTitle);
        header.appendChild(popLabel);
        header.appendChild(popClose);
        popover.appendChild(header);

        popBody = doc.createElement('div');
        popover.appendChild(popBody);

        popDiff = doc.createElement('div');
        setStyle(popDiff, {
          color: 'var(--anno-secondary)',
          font: '11px/1.4 ' + MONO,
          margin: '0 0 10px',
          'word-break': 'break-all',
          'max-height': '50px',
          overflow: 'auto',
        });
        popover.appendChild(popDiff);

        var actions = doc.createElement('div');
        setStyle(actions, {
          display: 'flex',
          gap: '6px',
          'justify-content': 'flex-end',
          'flex-wrap': 'wrap',
        });
        popEdit = makeButton(labels.edit || 'Edit', 'secondary');
        popDelete = makeButton(labels.delete || 'Delete', 'danger');
        popSave = makeButton(labels.save || 'Save', 'primary');
        popCancel = makeButton(labels.cancel || 'Cancel', 'secondary');
        popEdit.addEventListener('click', function () {
          if (activeId === null) return;
          var item = items.find(function (entry) {
            return entry.id === activeId;
          });
          if (!item) return;
          editing = true;
          renderPopover(item);
        });
        popDelete.addEventListener('click', deleteItem);
        popSave.addEventListener('click', saveEdit);
        popCancel.addEventListener('click', function () {
          if (activeId === null) return;
          var item = items.find(function (entry) {
            return entry.id === activeId;
          });
          if (!item) return;
          editing = false;
          renderPopover(item);
        });
        actions.appendChild(popEdit);
        actions.appendChild(popDelete);
        actions.appendChild(popSave);
        actions.appendChild(popCancel);
        popover.appendChild(actions);
        shadow.appendChild(popover);

        try {
          doc.documentElement.appendChild(host);
        } catch (error) {
          doc.body.appendChild(host);
        }
      }

      function bind() {
        listen(doc, 'pointerdown', onOutsidePointer, true);
        listen(doc, 'keydown', onKey, true);
        listen(doc, 'scroll', scheduleReposition, true);
        listen(win, 'resize', scheduleReposition, true);
        listen(host, 'pointerdown', stopAtHost, false);
        listen(host, 'click', stopAtHost, false);
        listen(host, 'keydown', stopAtHost, false);
        listen(host, 'keyup', stopAtHost, false);
        listen(doc, 'pagehide', dispose, true);
        listen(win, 'beforeunload', dispose, true);
        watchdog = win.setInterval(function () {
          if (Date.now() - state.lastContact > 30000) dispose();
        }, 5000);
      }

      var state;
      try {
        var stale = win[GLOBAL];
        if (stale && stale.token !== token && typeof stale.dispose === 'function') stale.dispose();
      } catch (error) {
        /* ignore */
      }
      state = {
        token: token,
        events: [],
        lastContact: Date.now(),
        setAnnotations: setAnnotations,
        setPaused: setPaused,
        dispose: dispose,
      };
      win[GLOBAL] = state;

      try {
        build();
        bind();
        applyScheme(detectScheme());
      } catch (error) {
        try {
          dispose();
        } catch (inner) {
          /* ignore */
        }
        return { ok: false, error: String(error && error.message ? error.message : error) };
      }
      return { ok: true };
    }

    // ---------------------------------------------------------------------
    // React surfaces
    // ---------------------------------------------------------------------

    const MENU_CSS = [
      '.dsh-browser-annotation-menu{display:flex;align-items:center;gap:8px;width:100%;',
      'padding:6px 8px;border:0;border-radius:6px;background:transparent;',
      'color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:1.4;',
      'text-align:left;cursor:pointer;white-space:nowrap;}',
      '.dsh-browser-annotation-menu:hover{background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-browser-annotation-menu:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);',
      'outline-offset:1px;}',
      '.dsh-browser-annotation-menu svg{flex:none;color:var(--dsw-alias-brand-primary);}',
    ].join('');

    function MenuIcon() {
      return h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
        },
        h('rect', {
          x: 1.4,
          y: 1.6,
          width: 9.2,
          height: 12.8,
          rx: 1.6,
          stroke: 'currentColor',
          strokeWidth: 1.2,
        }),
        h('path', {
          d: 'M3.6 4.6h4.8M3.6 7h3.2',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          opacity: 0.65,
        }),
        h('circle', { cx: 10.4, cy: 9.4, r: 3.4, stroke: 'currentColor', strokeWidth: 1.2 }),
        h('circle', { cx: 10.4, cy: 9.4, r: 0.9, fill: 'currentColor' }),
        h('path', {
          d: 'M12.6 8.9 15 10.3l-1.6.6-.6 1.6z',
          fill: 'currentColor',
          strokeLinejoin: 'round',
        }),
      );
    }

    function TabMenuEntry(props) {
      const tab = props.tab;
      const inputActions = props.inputActions;
      const fallbackT = function (key) {
        return en[key] || key;
      };
      const t = typeof props.t === 'function' ? props.t : fallbackT;
      if (!isDesktopCarrier()) return null;
      if (!tab || tab.kind !== 'browser') return null;
      if (!inputActions) return null;
      return h(
        React.Fragment,
        null,
        h('style', null, MENU_CSS),
        h(
          'button',
          {
            type: 'button',
            role: 'menuitem',
            className: 'dsh-browser-annotation-menu',
            title: t('menu.hint'),
            'aria-label': t('menu.label'),
            onClick: function (event) {
              event.preventDefault();
              event.stopPropagation();
              try {
                if (typeof props.dismiss === 'function') props.dismiss();
              } catch (error) {
                /* the menu may already be closing */
              }
              controller.start({
                tab: tab,
                inputActions: inputActions,
                sessionId: props.sessionId,
                t: t,
              });
            },
          },
          h(MenuIcon),
          h('span', null, t('menu.label')),
        ),
      );
    }

    const INPUT_BUTTON_CSS = [
      '.dsh-browser-annotation-input{display:inline-flex;align-items:center;gap:4px;height:26px;',
      'padding:0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;',
      'background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;',
      'line-height:1;cursor:pointer;white-space:nowrap;}',
      '.dsh-browser-annotation-input:hover{background:var(--dsw-alias-bg-layer-2);',
      'color:var(--dsw-alias-label-primary);}',
      '.dsh-browser-annotation-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);',
      'outline-offset:1px;}',
      '.dsh-browser-annotation-input svg{flex:none;color:var(--dsw-alias-brand-primary);}',
    ].join('');

    const EMPTY_TABS = [];

    function ComposerAnnotateButton(props) {
      const ctx = controller.ctx;
      const sessionId = props.sessionId;
      const inputActions = props.inputActions;
      const t =
        typeof props.t === 'function'
          ? props.t
          : function (key) {
              return en[key] || key;
            };
      const openTabs = ctx && ctx.sidebarRight ? ctx.sidebarRight.openTabs : undefined;
      const subscribeTabs = React.useCallback(
        function (listener) {
          if (!openTabs || typeof openTabs.subscribe !== 'function') {
            return function () {};
          }
          return openTabs.subscribe(listener);
        },
        [openTabs],
      );
      const getTabs = React.useCallback(
        function () {
          return openTabs && typeof openTabs.getSnapshot === 'function'
            ? openTabs.getSnapshot()
            : EMPTY_TABS;
        },
        [openTabs],
      );
      const tabs = useSyncExternalStore(subscribeTabs, getTabs, getTabs);
      if (!isDesktopCarrier() || !ctx || !inputActions) return null;
      const browserTabs = Array.isArray(tabs)
        ? tabs.filter(function (tab) {
            return tab && tab.sessionId === sessionId && tab.kind === 'browser';
          })
        : [];
      return h(
        React.Fragment,
        null,
        h('style', null, INPUT_BUTTON_CSS),
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-browser-annotation-input',
            'data-dsh-browser-annotation': 'button',
            title: t('input.tooltip'),
            'aria-label': t('input.tooltip'),
            onClick: function (event) {
              event.preventDefault();
              event.stopPropagation();
              if (controller.phase !== 'idle') {
                controller.abort('');
                return;
              }
              const target = findAnnotatableTab(sessionId, browserTabs);
              if (!target) {
                controller.notify(t('toast.noWebview'));
                return;
              }
              controller.start({
                tab: target,
                inputActions: inputActions,
                sessionId: sessionId,
                t: t,
              });
            },
          },
          h(MenuIcon),
          h('span', null, t('input.button')),
        ),
      );
    }

    const DOCK_CSS = [
      '.dsh-ba-dock{margin:0 0 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;',
      'background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);',
      'font:inherit;font-size:12px;overflow:hidden;}',
      '.dsh-ba-dock-head{display:flex;align-items:center;gap:8px;padding:8px 10px;',
      'border-bottom:1px solid var(--dsw-alias-border-l1);}',
      '.dsh-ba-dock-icon{color:var(--dsw-alias-brand-primary);font-size:14px;line-height:1;}',
      '.dsh-ba-dock-title{font-size:13px;font-weight:600;}',
      '.dsh-ba-dock-count{font-size:11px;color:var(--dsw-alias-label-secondary);',
      'background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 7px;}',
      '.dsh-ba-dock-url{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      'white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px;}',
      '.dsh-ba-dock-text{border:0;background:transparent;color:var(--dsw-alias-label-secondary);',
      'font:inherit;font-size:11px;cursor:pointer;padding:2px 4px;border-radius:6px;}',
      '.dsh-ba-dock-text:hover{background:var(--dsw-alias-bg-layer-2);',
      'color:var(--dsw-alias-label-primary);}',
      '.dsh-ba-dock-danger{color:var(--dsw-alias-state-error-primary);}',
      '.dsh-ba-dock-list{max-height:240px;overflow:auto;}',
      '.dsh-ba-dock-row{display:flex;gap:8px;padding:8px 10px;',
      'border-top:1px solid var(--dsw-alias-border-l1);align-items:flex-start;}',
      '.dsh-ba-dock-row:first-child{border-top:0;}',
      '.dsh-ba-dock-num{flex:none;width:20px;height:20px;border-radius:50%;',
      'background:var(--dsw-alias-brand-primary);color:#fff;font-size:11px;font-weight:600;',
      'display:flex;align-items:center;justify-content:center;}',
      '.dsh-ba-dock-main{flex:1 1 auto;min-width:0;}',
      '.dsh-ba-dock-el{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;',
      'text-overflow:ellipsis;}',
      '.dsh-ba-dock-note{font-size:12px;color:var(--dsw-alias-label-primary);',
      'white-space:pre-wrap;word-break:break-word;margin-top:2px;}',
      '.dsh-ba-dock-empty{color:var(--dsw-alias-label-secondary);}',
      '.dsh-ba-dock-diff{font-size:11px;color:var(--dsw-alias-label-secondary);',
      'font-family:var(--ds-font-family-code,ui-monospace,monospace);margin-top:2px;',
      'word-break:break-all;}',
      '.dsh-ba-dock-edit{width:100%;box-sizing:border-box;margin-top:4px;min-height:50px;',
      'max-height:120px;resize:vertical;background:var(--dsw-alias-bg-layer-2);',
      'color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1);',
      'border-radius:8px;padding:6px 8px;font:inherit;font-size:12px;line-height:1.5;outline:none;}',
      '.dsh-ba-dock-actions{display:flex;flex-direction:column;gap:2px;flex:none;align-items:flex-end;}',
      '.dsh-ba-dock-save{color:var(--dsw-alias-brand-primary);}',
      '.dsh-ba-dock-foot{display:flex;align-items:center;gap:8px;padding:8px 10px;',
      'border-top:1px solid var(--dsw-alias-border-l1);}',
      '.dsh-ba-dock-hint{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-secondary);',
      'font-size:11px;line-height:1.4;}',
      '.dsh-ba-dock-add{flex:none;height:28px;padding:0 12px;border:0;border-radius:8px;',
      'background:var(--dsw-alias-brand-primary);color:#fff;font:inherit;font-size:12px;',
      'font-weight:600;cursor:pointer;}',
      '.dsh-ba-dock-add:disabled{opacity:.5;cursor:default;}',
    ].join('');

    const insertedSignatures = new Map();

    function annotationSignature(items) {
      return items
        .map(function (item) {
          return item.id + ':' + item.updatedAt;
        })
        .join('|');
    }

    function buildCombinedBlock(items, t) {
      const lines = [ANNO_START];
      lines.push(t('card.title') + ' · ' + items.length + ' ' + t('dock.unit'));
      items.forEach(function (item, index) {
        lines.push('');
        lines.push('### ' + (index + 1) + '. ' + chipElementLabel(item.info));
        lines.push(item.block);
      });
      lines.push('');
      lines.push(ANNO_END);
      let block = lines.join('\n');
      if (block.length > 14000) block = block.slice(0, 13999) + '…';
      return block;
    }

    function buildSetChip(items, tabData, t) {
      const label = clampText(
        t('chip.label') + ' · ' + items.length + ' ' + t('dock.unit'),
        80,
      );
      const clipboard = clampText(t('chip.clipboard'), 40);
      const block = buildCombinedBlock(items, t);
      const payload = {
        v: 1,
        block: block,
        label: label,
        clipboard: clipboard,
        url: (tabData && tabData.url) || (items[0] && items[0].info.url) || '',
        count: items.length,
      };
      return {
        source: CHIP_SOURCE,
        ref: JSON.stringify(payload),
        label: label,
        clipboardText: clipboard,
      };
    }

    function AnnotationDock(props) {
      const ctx = controller.ctx;
      const sessionId = props.sessionId;
      const inputActions = props.inputActions;
      const t =
        typeof props.t === 'function'
          ? props.t
          : function (key) {
              return en[key] || key;
            };
      const snapshot = useSyncExternalStore(
        annotations.subscribe,
        annotations.getSnapshot,
        annotations.getSnapshot,
      );
      const [activeTab, setActiveTab] = useState(null);
      const [editingId, setEditingId] = useState(null);
      const [draftNote, setDraftNote] = useState('');

      useEffect(
        function () {
          const read = function () {
            try {
              const tab =
                ctx && ctx.sidebarRight ? ctx.sidebarRight.active() : undefined;
              if (tab && tab.kind === 'browser' && typeof tab.id === 'string') {
                setActiveTab({ id: tab.id, title: tab.title || '' });
              } else {
                setActiveTab(null);
              }
            } catch (error) {
              setActiveTab(null);
            }
          };
          read();
          const timer = setInterval(read, 600);
          return function () {
            clearInterval(timer);
          };
        },
        [ctx],
      );

      if (!ctx || !inputActions) return null;
      const tabData = activeTab ? snapshot.byTab[activeTab.id] : null;
      const items = tabData ? tabData.items : [];
      if (!activeTab || items.length === 0) return null;
      const tabId = activeTab.id;
      const signature = annotationSignature(items);
      const prior = insertedSignatures.get(tabId);
      const addedState =
        prior === undefined ? 'new' : prior === signature ? 'added' : 'changed';
      const addLabel =
        addedState === 'added'
          ? t('dock.added')
          : addedState === 'changed'
            ? t('dock.reAdd')
            : t('dock.add');
      const beginEdit = function (item) {
        setEditingId(item.id);
        setDraftNote(item.note || '');
      };
      const saveEdit = function (item) {
        const note = clampText(draftNote, CAP.note).trim();
        const block = buildAnnotationBlock(item.info, note, item.edits, t);
        annotations.update(tabId, item.id, {
          note: note,
          block: block,
          updatedAt: Date.now(),
        });
        setEditingId(null);
        setDraftNote('');
      };
      const remove = function (id) {
        annotations.remove(tabId, id);
        if (editingId === id) setEditingId(null);
      };
      const clearAll = function () {
        annotations.clear(tabId);
        setEditingId(null);
      };
      const addToChat = function () {
        const chip = buildSetChip(items, tabData, t);
        let ok = insertChipIntoDraft(inputActions, ctx, sessionId, chip);
        if (!ok) {
          ok = insertTextIntoDraft(inputActions, buildCombinedBlock(items, t));
          if (ok) controller.notify(t('toast.chipFallback'));
        }
        if (ok) {
          insertedSignatures.set(tabId, signature);
          controller.notify(t('dock.added'));
        } else {
          controller.notify(t('toast.draftChanged'));
        }
      };
      return h(
        React.Fragment,
        null,
        h('style', null, DOCK_CSS),
        h(
          'section',
          { className: 'dsh-ba-dock', 'data-dsh-browser-annotation': 'dock' },
          h(
            'header',
            { className: 'dsh-ba-dock-head' },
            h('span', { className: 'dsh-ba-dock-icon' }, '◎'),
            h('strong', { className: 'dsh-ba-dock-title' }, t('dock.title')),
            h(
              'span',
              { className: 'dsh-ba-dock-count' },
              String(items.length) + ' ' + t('dock.unit'),
            ),
            h(
              'span',
              { className: 'dsh-ba-dock-url', title: tabData.url || '' },
              tabData.url || '',
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-ba-dock-text',
                onClick: clearAll,
              },
              t('dock.clear'),
            ),
          ),
          h(
            'div',
            { className: 'dsh-ba-dock-list' },
            items.map(function (item, index) {
              const diff = item.edits ? diffSummary(item.edits, t) : '';
              return h(
                'div',
                { className: 'dsh-ba-dock-row', key: item.id },
                h('span', { className: 'dsh-ba-dock-num' }, String(index + 1)),
                h(
                  'div',
                  { className: 'dsh-ba-dock-main' },
                  h('div', { className: 'dsh-ba-dock-el' }, chipElementLabel(item.info)),
                  editingId === item.id
                    ? h('textarea', {
                        className: 'dsh-ba-dock-edit',
                        value: draftNote,
                        maxLength: CAP.note,
                        rows: 2,
                        onChange: function (event) {
                          setDraftNote(event.target.value);
                        },
                      })
                    : h(
                        'div',
                        {
                          className:
                            'dsh-ba-dock-note' + (item.note ? '' : ' dsh-ba-dock-empty'),
                        },
                        item.note || t('dock.emptyNote'),
                      ),
                  diff
                    ? h('div', { className: 'dsh-ba-dock-diff' }, diff)
                    : null,
                ),
                h(
                  'div',
                  { className: 'dsh-ba-dock-actions' },
                  editingId === item.id
                    ? h(
                        React.Fragment,
                        null,
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dsh-ba-dock-text dsh-ba-dock-save',
                            onClick: function () {
                              saveEdit(item);
                            },
                          },
                          t('dock.save'),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dsh-ba-dock-text',
                            onClick: function () {
                              setEditingId(null);
                            },
                          },
                          t('dock.cancel'),
                        ),
                      )
                    : h(
                        React.Fragment,
                        null,
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dsh-ba-dock-text',
                            onClick: function () {
                              beginEdit(item);
                            },
                          },
                          t('dock.edit'),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'dsh-ba-dock-text dsh-ba-dock-danger',
                            onClick: function () {
                              remove(item.id);
                            },
                          },
                          t('dock.delete'),
                        ),
                      ),
                ),
              );
            }),
          ),
          h(
            'footer',
            { className: 'dsh-ba-dock-foot' },
            h(
              'span',
              { className: 'dsh-ba-dock-hint' },
              addedState === 'changed' ? t('dock.changed') : t('dock.hint'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-ba-dock-add',
                disabled: addedState === 'added',
                onClick: addToChat,
              },
              addLabel,
            ),
          ),
        ),
      );
    }

    const annotationTextRule = {
      id: 'browser-annotation',
      order: -1000,
      match: function (text, from) {
        if (typeof text !== 'string') return undefined;
        const start = text.indexOf(ANNO_START, from);
        if (start < 0) return undefined;
        const end = text.indexOf(ANNO_END, start + ANNO_START.length);
        if (end < 0) return undefined;
        const stop = end + ANNO_END.length;
        return {
          id: 'browser-annotation',
          start: start,
          end: stop,
          data: { raw: text.slice(start, stop) },
        };
      },
    };

    const CARD_CSS = [
      '.dsh-ba-card{display:block;margin:6px 0;border:1px solid var(--dsw-alias-border-l1);',
      'border-radius:12px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;max-width:100%;}',
      '.dsh-ba-card-head{display:flex;align-items:center;gap:8px;width:100%;padding:9px 11px;',
      'border:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;',
      'font-size:12px;text-align:left;cursor:pointer;}',
      '.dsh-ba-card-head:hover{background:var(--dsw-alias-bg-layer-2);}',
      '.dsh-ba-card-icon{color:var(--dsw-alias-brand-primary);font-size:14px;line-height:1;}',
      '.dsh-ba-card-title{font-weight:600;white-space:nowrap;}',
      '.dsh-ba-card-count{font-size:11px;color:var(--dsw-alias-label-secondary);',
      'background:var(--dsw-alias-bg-layer-2);border-radius:999px;padding:1px 7px;}',
      '.dsh-ba-card-url{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      'white-space:nowrap;color:var(--dsw-alias-label-secondary);font-size:11px;}',
      '.dsh-ba-card-chevron{flex:none;color:var(--dsw-alias-label-secondary);font-size:11px;}',
      '.dsh-ba-card-body{display:block;padding:8px 11px 10px;',
      'border-top:1px solid var(--dsw-alias-border-l1);',
      'font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px;',
      'line-height:1.5;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;',
      'word-break:break-word;max-height:260px;overflow:auto;}',
    ].join('');

    function AnnotationTextCard(props) {
      const t =
        typeof props.t === 'function'
          ? props.t
          : function (key) {
              return en[key] || key;
            };
      const data = props.node && props.node.data ? props.node.data : {};
      const raw =
        typeof data.raw === 'string'
          ? data.raw
          : typeof props.raw === 'string'
            ? props.raw
            : '';
      const [open, setOpen] = useState(false);
      const urlMatch = raw.match(/https?:\/\/[^\s)\]]+/);
      const url = urlMatch ? urlMatch[0] : '';
      const countMatch = raw.match(/·\s*(\d+)/);
      const count = countMatch ? Number(countMatch[1]) : 0;
      const body = raw.split(ANNO_START).join('').split(ANNO_END).join('').trim();
      return h(
        React.Fragment,
        null,
        h('style', null, CARD_CSS),
        h(
          'span',
          { className: 'dsh-ba-card' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-ba-card-head',
              'aria-expanded': open,
              onClick: function () {
                setOpen(!open);
              },
            },
            h('span', { className: 'dsh-ba-card-icon' }, '◎'),
            h('span', { className: 'dsh-ba-card-title' }, t('card.title')),
            count > 0
              ? h(
                  'span',
                  { className: 'dsh-ba-card-count' },
                  String(count) + ' ' + t('dock.unit'),
                )
              : null,
            url ? h('span', { className: 'dsh-ba-card-url', title: url }, url) : null,
            h('span', { className: 'dsh-ba-card-chevron' }, open ? '⌃' : '⌄'),
          ),
          open ? h('span', { className: 'dsh-ba-card-body' }, body) : null,
        ),
      );
    }

    const TOAST_CSS = [
      '.dsh-browser-annotation-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);',
      'display:flex;align-items:flex-start;gap:10px;max-width:min(520px,calc(100vw - 32px));',
      'padding:10px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;',
      'background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);',
      'box-shadow:0 10px 30px rgba(0,0,0,.18);font:inherit;font-size:13px;line-height:1.5;',
      'pointer-events:auto;z-index:30;}',
      '.dsh-browser-annotation-toast button{flex:none;border:0;background:transparent;',
      'color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;padding:0 2px;',
      'line-height:1.2;}',
      '.dsh-browser-annotation-toast button:hover{color:var(--dsw-alias-label-primary);}',
    ].join('');

    function NoticeToast(props) {
      const t = typeof props.t === 'function' ? props.t : function (key) {
        return en[key] || key;
      };
      const notice = useSyncExternalStore(
        controller.notice.subscribe,
        controller.notice.getSnapshot,
        controller.notice.getSnapshot,
      );
      useEffect(
        function () {
          if (!notice) return undefined;
          const timer = setTimeout(function () {
            controller.notice.dismiss(notice.id);
          }, 6000);
          return function () {
            clearTimeout(timer);
          };
        },
        [notice],
      );
      if (!notice) return null;
      return h(
        React.Fragment,
        null,
        h('style', null, TOAST_CSS),
        h(
          'div',
          {
            className: 'dsh-browser-annotation-toast',
            role: 'status',
            'aria-live': 'polite',
          },
          h('span', { style: { flex: '1 1 auto' } }, notice.message),
          h(
            'button',
            {
              type: 'button',
              'aria-label': t('panel.close'),
              onClick: function () {
                controller.notice.dismiss(notice.id);
              },
            },
            '×',
          ),
        ),
      );
    }


    // ---------------------------------------------------------------------
    // Plugin
    // ---------------------------------------------------------------------

    const controller = new AnnotationController(null);

    function apply(ctx) {
      controller.disposed = false;
      controller.ctx = ctx;
      markerManager = new MarkerManager(ctx, controller);
      ctx.effect(
        function () {
          return function () {
            if (markerManager) {
              markerManager.dispose();
              markerManager = null;
            }
          };
        },
        'browser-annotation: markers',
      );
      ctx.effect(
        function () {
          return ctx.locale.register(NS, { zh: zh, en: en });
        },
        'browser-annotation: locale',
      );
      ctx.inject(['inputTriggers'], function (inputCtx) {
        inputCtx.effect(
          function () {
            return inputCtx.inputTriggers.registerSource({
              name: CHIP_SOURCE,
              codec: {
                clipboardText: chipClipboardText,
                serialize: function (ref) {
                  try {
                    return Promise.resolve(chipSerializedBlock(ref));
                  } catch (error) {
                    return Promise.reject(error);
                  }
                },
              },
            });
          },
          'browser-annotation: chip codec',
        );
      });
      ctx.inject(['uiConversation'], function (conversationCtx) {
        conversationCtx.effect(
          function () {
            return conversationCtx.uiConversation.userText.register(annotationTextRule);
          },
          'browser-annotation: user text rule',
        );
        conversationCtx.effect(
          function () {
            return conversationCtx.slots.inject('conversation.user.text.node', function () {
              return conversationCtx.slots.register(
                {
                  name: 'conversation.user.text.node',
                  key: 'browser-annotation',
                  priority: 100,
                  locale: NS,
                },
                AnnotationTextCard,
              );
            });
          },
          'browser-annotation: user text card',
        );
      });
      ctx.effect(
        function () {
          return ctx.slots.inject('sidebar.right.tab.menu.item', function () {
            return ctx.slots.register(
              {
                name: 'sidebar.right.tab.menu.item',
                id: 'browser-annotation',
                order: 100,
                locale: NS,
              },
              TabMenuEntry,
            );
          });
        },
        'browser-annotation: tab menu',
      );
      ctx.effect(
        function () {
          return ctx.slots.inject('conversation.input.left', function () {
            return ctx.slots.register(
              {
                name: 'conversation.input.left',
                id: 'browser-annotation',
                order: 10,
                locale: NS,
              },
              ComposerAnnotateButton,
            );
          });
        },
        'browser-annotation: input button',
      );
      ctx.effect(
        function () {
          return ctx.slots.inject('conversation.input.dock', function () {
            return ctx.slots.register(
              {
                name: 'conversation.input.dock',
                id: 'browser-annotation.dock',
                order: 5,
                locale: NS,
              },
              AnnotationDock,
            );
          });
        },
        'browser-annotation: dock',
      );
      ctx.effect(
        function () {
          return ctx.slots.inject('shell.overlay', function () {
            return ctx.slots.register(
              {
                name: 'shell.overlay',
                id: 'browser-annotation.notice',
                order: 1000,
                locale: NS,
              },
              NoticeToast,
            );
          });
        },
        'browser-annotation: notice',
      );
      ctx.effect(
        function () {
          return function () {
            controller.dispose();
          };
        },
        'browser-annotation: controller',
      );
    }

    return {
      inject: ['slots', 'locale', 'sidebarRight'],
      apply: apply,
    };
  },
});
