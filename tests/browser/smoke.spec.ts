import "dotenv/config";
import { test, expect } from "@playwright/test";
test("CMS login and complete PDF knowledge journey", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(process.env.ADMIN_BOOTSTRAP_EMAIL!);
  await page.getByLabel(/Password/).fill(process.env.ADMIN_BOOTSTRAP_PASSWORD!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(
    page.getByRole("heading", { name: "Your knowledge, connected" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Knowledge bases", exact: true })
    .click();
  await page
    .getByText("Create a knowledge base", { exact: true })
    .first()
    .click();
  const name = `Browser smoke ${Date.now()}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create knowledge base", exact: true })
    .click();
  await page
    .getByLabel("Upload document")
    .setInputFiles("tests/fixtures/refunds.pdf");
  await expect(page.getByText("ready", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page
    .getByRole("link", { name: "AI conversations", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Knowledge base", exact: true })
    .selectOption({ label: name });
  await page
    .getByLabel("Question", { exact: true })
    .fill("What is the return period?");
  await page.getByRole("button", { name: /Ask knowledge hub/ }).click();
  await expect(page.getByText(/Mock extract/)).toBeVisible();
  await page.getByText("[1] refunds.pdf", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Download source" }),
  ).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download source" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("refunds.pdf");
  await page
    .getByRole("link", { name: "Knowledge bases", exact: true })
    .click();
  await page.getByRole("button", { name: new RegExp(name) }).click();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByText("No documents yet. Upload a source to begin."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete knowledge base", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp(name) }),
  ).toHaveCount(0);
});
