import { chromium, expect, test } from "@playwright/test";


//@Annotations
test.describe("Create leads by single and import files", async() => {

    
    test("Create a single 1", async( {page}) => {
        console.log("done 1");
    });

    test("Create a single 2", async( {page}) => {
        console.log("done 2");
    });

    
    test.setTimeout(50000);
    test.fail(({browserName}) => browserName === "chromium")
    test("Create a single 3", async( {page}) => {
        console.log("done 3");
    });

    test.skip(({browserName}) => browserName === "chromium")
    test("Create a single 4", async( {page}) => {
        console.log("done 4");
    })

})


test.describe("valid case 1", async() => {

    test("Create a single 1", async( {page}) => {
      

    await page.locator('#et_pb_contact_name_0').fill("mypucteddy");
    await page.locator("APjFqb").pressSequentially("Playwright", {delay:1000});
    await page.locator("APjFqb").press("ArrowDown+ArrowDown+ArrowDown");
    await page.locator("APjFqb").press("Enter");
    await page.locator("APjFqb").press("Backspace");
    })

    })