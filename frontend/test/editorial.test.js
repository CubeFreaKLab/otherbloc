import { test } from 'node:test'
import assert from 'node:assert/strict'
import { articles, authors, filterArticles, publicationTypes } from '../src/data/articles.js'
import { readThemePreference, resolveTheme } from '../src/utils/theme.js'

test('demo edition covers every publication type with independent content and valid author references', () => {
  assert.deepEqual(new Set(articles.map((article) => article.type)), new Set(publicationTypes))
  assert.equal(new Set(articles.map((article) => article.slug)).size, articles.length)
  assert.equal(new Set(articles.map((article) => JSON.stringify(article.blocks))).size, articles.length)
  for (const article of articles) {
    assert.ok(article.demo)
    assert.ok(authors.some((author) => author.id === article.authorId))
    assert.ok(article.blocks.length >= 3)
    assert.ok(article.imageAlt && article.tags.length)
  }
})

test('search ignores accents, preserves combined filters and reports truly empty results', () => {
  assert.equal(filterArticles(articles, { query: 'maria' }).length, 2)
  assert.equal(filterArticles(articles, { category: 'tecnologia' }).length, 1)
  assert.equal(filterArticles(articles, { category: 'Escritura', type: 'Guía', query: 'borrador' }).length, 1)
  assert.equal(filterArticles(articles, { query: 'inexistente-123' }).length, 0)
})

test('theme handles system preferences, invalid stored values and unavailable storage', () => {
  assert.equal(resolveTheme('system', true), 'dark')
  assert.equal(resolveTheme('system', false), 'light')
  assert.equal(resolveTheme('light', true), 'light')
  assert.equal(readThemePreference({ getItem: () => 'invalid' }), 'system')
  assert.equal(readThemePreference({ getItem: () => { throw new Error('blocked') } }), 'system')
  assert.equal(readThemePreference({ getItem: () => 'dark' }), 'dark')
})
