import { chromium } from 'playwright'
const BASE='http://localhost:5173', OUT='assets/pitch/screens'
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:402,height:874},deviceScaleFactor:2}); const p=await ctx.newPage()
const tap=async(t,o={})=>{for(const x of (Array.isArray(t)?t:[t])){try{await p.getByText(x,o).first().click({timeout:2500});return true}catch{}}return false}
await p.goto(BASE,{waitUntil:'networkidle'})
await p.evaluate(()=>{localStorage.setItem('relish-media-mode','image');localStorage.removeItem('relish.cart.v1')})
await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(2000)
await tap(['Open Menu','View Menu']); await p.waitForTimeout(1300)
// pick a dish with a strong hero image
const card=p.locator('div',{hasText:/₹\d/}).filter({has:p.locator('img,video')}).first()
await card.click({timeout:3000}); await p.waitForTimeout(1600)
await p.screenshot({path:`${OUT}/guest-item-detail.png`})
console.log('re-shot guest-item-detail in image mode')
await b.close()
