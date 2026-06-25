import { test, expect } from '@playwright/test';
import { gotoReady } from './helpers';

test.describe('search page', () => {
  test('lists all tools and shows a count', async ({ page }) => {
    await gotoReady(page, '/search-tools');
    await expect(page.getByRole('heading', { name: 'All tools' })).toBeVisible();
    // both known tools render as links
    await expect(page.getByRole('link', { name: 'Mortgage Calculator' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Serialization Converter' })).toBeVisible();
    await expect(page.getByText(/Showing all \d+ tools/)).toBeVisible();
  });

  test('typing a query filters the list', async ({ page }) => {
    await gotoReady(page, '/search-tools');
    await page.getByPlaceholder(/Search tools/i).fill('mortgage');
    await expect(page.getByText(/tools? matching "mortgage"/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mortgage Calculator' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Serialization Converter' })).toHaveCount(0);
  });

  test('finds a tool via a tag synonym not in its name', async ({ page }) => {
    await gotoReady(page, '/search-tools');
    await page.getByPlaceholder(/Search tools/i).fill('protobuf to json');
    await expect(page.getByRole('link', { name: 'Serialization Converter' })).toBeVisible();
  });

  test('a category hash filters to that category only', async ({ page }) => {
    await gotoReady(page, '/search-tools#dev');
    await expect(page.getByText(/tools? in Developer/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Serialization Converter' })).toBeVisible();
    // financial tools are filtered out
    await expect(page.getByRole('link', { name: 'Mortgage Calculator' })).toHaveCount(0);
    // category nav still present
    await expect(page.getByRole('link', { name: /Developer/ }).first()).toBeVisible();
  });

  test('clearing the category filter shows all tools again', async ({ page }) => {
    await gotoReady(page, '/search-tools#dev');
    await expect(page.getByText(/tools? in Developer/)).toBeVisible();
    await page.getByRole('button', { name: /Show all categories/ }).click();
    await expect(page.getByText(/Showing all \d+ tools/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mortgage Calculator' })).toBeVisible();
  });

  test('navigating to a tool page works', async ({ page }) => {
    await gotoReady(page, '/search-tools');
    await page.getByRole('link', { name: 'Serialization Converter' }).click();
    await expect(page).toHaveURL(/\/tools\/dev\/serialization-converter/);
    await expect(page.getByRole('heading', { name: 'Serialization Converter' })).toBeVisible();
  });
});
