/** Crops a region of a rendered poster so fine detail can be inspected. */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import fs from "node:fs";
const [file, x, y, w, h, out] = process.argv.slice(2);
const img = await loadImage(fs.readFileSync(file));
const c = createCanvas(Number(w), Number(h));
c.getContext("2d").drawImage(img, Number(x), Number(y), Number(w), Number(h), 0, 0, Number(w), Number(h));
fs.writeFileSync(out, c.toBuffer("image/png"));
console.log("wrote", out);
