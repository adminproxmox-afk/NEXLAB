import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { collectCommunityQuestions } from '../frontend/js/community-feed.js';
const source = (await readFile(new URL('../frontend/js/community-projects.js', import.meta.url), 'utf8')).replace(/import[\s\S]*?from ".*?";/g, '').replace('export async function', 'async function');
async function setup(pages) {
  const element = () => ({ innerHTML: '', setAttribute() {}, removeAttribute() {}, querySelectorAll() { return []; }, querySelector() { return null; }, insertAdjacentHTML(_, html) { this.innerHTML += html; } });
  const grid = element(), questions = element();
  const handlers = {}, calls = [];
  const root = { querySelector: s => s === '[data-community-project-grid]' ? grid : s === '[data-community-questions]' ? questions : null, querySelectorAll: () => [], hasAttribute: () => false, addEventListener: (type, fn) => { handlers[type] = fn; } };
  const context = vm.createContext({ document: { querySelector: () => root }, location: { hash: '' }, getCommunityProjects: async options => { calls.push(options); const page = pages.shift(); if (page instanceof Error) throw page; return page; }, collectCommunityQuestions, formatDate: value => new Intl.DateTimeFormat('en').format(new Date(value)), getCurrentUser: () => null, hasAdminPermission: () => false });
  await vm.runInContext(source + '; initializeCommunityProjects()', context);
  return { grid, questions, calls, async click(selector) { handlers.click({ target: { closest: s => s === selector } }); await new Promise(resolve => setImmediate(resolve)); } };
}
const project = (id, dates = ['2026-01-01']) => ({ id, title: id, date: '2026-01-01', comments: [], questions: dates.map((date, i) => ({ id: String(i), date, text: `question-${id}-${i}` })) });
test('questions retain earlier pages including an empty second page and expose shared load more', async () => {
 const view = await setup([{ projects: [project('first')], hasMore: true }, { projects: [project('second', [])], hasMore: false }]);
 assert.match(view.questions.innerHTML, /data-community-more/);
 await view.click('[data-community-more]');
 assert.match(view.questions.innerHTML, /question-first-0/);
 assert.match(view.grid.innerHTML, /second/);
 assert.equal(view.calls[1].append, true);
});
test('blank, missing and malformed dates render fallback in both question and build cards', async () => {
 const view = await setup([{ projects: [project('bad', ['', undefined, 'not-a-date'])], hasMore: false }]);
 for (const html of [view.grid.innerHTML, view.questions.innerHTML]) {
  assert.match(html, /question-bad-2/);
  assert.equal((html.match(/Дату не вказано/g) || []).length, 3);
  assert.doesNotMatch(html, /datetime="(?:|undefined|not-a-date)"/);
 }
});
test('initial failure replaces Questions loading with retry and retry recovers', async () => {
 const view = await setup([new Error('offline'), { projects: [project('recovered')], hasMore: false }]);
 assert.match(view.questions.innerHTML, /data-community-retry/);
 assert.match(view.questions.innerHTML, /Не вдалося завантажити питання/);
 await view.click('[data-community-retry]');
 assert.match(view.questions.innerHTML, /question-recovered-0/);
});
test('append failure keeps discussions with append retry and successful retry aggregates pages', async () => {
 const view = await setup([{ projects: [project('first')], hasMore: true }, new Error('offline'), { projects: [project('second')], hasMore: false }]);
 await view.click('[data-community-more]');
 assert.match(view.questions.innerHTML, /question-first-0/);
 assert.match(view.questions.innerHTML, /data-community-retry-append/);
 await view.click('[data-community-retry-append]');
 assert.match(view.questions.innerHTML, /question-first-0/);
 assert.match(view.questions.innerHTML, /question-second-0/);
 assert.doesNotMatch(view.questions.innerHTML, /data-community-load-error/);
});
test('empty discussions describe loaded-project scope and per-project cap', async () => {
 const view = await setup([{ projects: [], hasMore: true }]);
 assert.match(view.questions.innerHTML, /до 30 питань на проєкт/);
 assert.match(view.questions.innerHTML, /У завантажених проєктах питань поки немає/);
 assert.match(view.questions.innerHTML, /data-community-more/);
});
test('fresh loads reset accumulated questions', async () => {
 const view = await setup([{ projects: [project('old')], hasMore: true }, { projects: [project('appended')], hasMore: false }, { projects: [project('fresh')], hasMore: false }]);
 await view.click('[data-community-more]');
 await view.click('[data-community-retry]');
 assert.match(view.questions.innerHTML, /question-fresh-0/);
 assert.doesNotMatch(view.questions.innerHTML, /question-old|question-appended/);
 assert.equal(view.calls[2].append, false);
});
