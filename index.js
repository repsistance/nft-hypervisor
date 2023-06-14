const express = require("express");
const fs = require("fs");
const client = require("https");
const { createCanvas, loadImage, registerFont } = require("canvas");

const app = express();
const port = process.env.PORT || '1337';

app.get("/", [
 validateRequest,
 createIdentifier,
 downloadBackground,
 downloadLogo,
 downloadOverlay,
 composeImage,
 sendImage,
 cleanupFiles,
]);

app.listen(port, function () {
 console.log(`Image API listening on port ${port}!`);
});

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
            v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function validateRequest(req, res, next) {
 if (!req.query.background){
 return res.status(400).send("missing background");
 }
 if (!req.query.logo){
 return res.status(400).send("missing logo");
 }
 if (!req.query.text){
 return res.status(400).send("missing text");
 }
 next();
}

function createIdentifier(req, res, next) {
 const identifier = generateUUID();
 req.identifier = identifier;
 next();
}

function downloadBackground(req, res, next) {
 const url = req.query.background;
 const file = fs.createWriteStream(`./${req.identifier}-background.png`);

 client.get(url, (webRes) => {
 if (webRes.statusCode < 200 || webRes.statusCode > 299) {
 return res.status(400).send(`Got status code ${webRes.statusCode} while downloading background`);
 }
 webRes.pipe(file).once("close", () => {
 next();
 });
 }).on("error",(err)=>{
 return res.status(500).send("error downloading background");
 });
}

function downloadLogo(req, res, next) {
 const url = req.query.logo;
 const file = fs.createWriteStream(`./${req.identifier}-logo.png`);

 client.get(url, (webRes) => {
 if (webRes.statusCode < 200 || webRes.statusCode > 299) {
 return res.status(400).send(`Got status code ${webRes.statusCode} while downloading logo`);
 }
 webRes.pipe(file).once("close", () => {
 next();
 });
 }).on("error",(err)=>{
 return res.status(500).send("error downloading logo");
 });
}

function downloadOverlay(req, res, next) {
 const url = req.query.overlay;
 const file = fs.createWriteStream(`./${req.identifier}-overlay.png`);

 client.get(url, (webRes) => {
 if (webRes.statusCode < 200 || webRes.statusCode > 299) {
 return res.status(400).send(`Got status code ${webRes.statusCode} while downloading overlay`);
 }
 webRes.pipe(file).once("close", () => {
 next();
 });
 }).on("error",(err)=>{
 return res.status(500).send("error downloading overlay");
 });
}

async function composeImage(req, res, next) {
 const background = await loadImage(`./${req.identifier}-background.png`);
 const logo = await loadImage(`./${req.identifier}-logo.png`);
 const overlay = await loadImage(`./${req.identifier}-overlay.png`);

 const width = background.width;
 const height = background.height;

 const canvas = createCanvas(width, height);
 const context = canvas.getContext("2d");

 context.drawImage(background, 0, 0, width, height);
 context.drawImage(overlay, 0, 0, width, height);

 // Calculate the x-coordinate for the logo to center it
 const logoX = (width - logo.width) / 2;
 const logoY = 20; // You can adjust this value to position the logo further from the top
 context.drawImage(logo, logoX, logoY);

 const textSize = context.measureText(req.query.text);
 context.font = "bold 70pt sans-serif"; // Using a default font
 context.textAlign = "center";
 context.textBaseline = "middle";
 // Set the text color based on the 'text-color' query parameter
 const textColor = "#"+req.query['text-color'] || "#444";
 context.fillStyle = textColor;
 //context.fillStyle = "rgba(255, 255, 255, 0.8)"
 //context.fillStyle = "#444";

 const words = req.query.text.split(' ');
 const lines = [];
 let currentLine = words[0];

 for (let i = 1; i < words.length; i++) {
     const word = words[i];
     const width = context.measureText(currentLine + " " + word).width;
     if (width < background.width) {
         currentLine += " " + word;
     } else {
         lines.push(currentLine);
         currentLine = word;
     }
 }
 lines.push(currentLine);

 const lineHeight = 70; // Line height
 let y = (height - lines.length * lineHeight) / 2;

 for (const line of lines) {
     context.fillText(line, width / 2, y);
     y += lineHeight;
 }

 const buffer = canvas.toBuffer("image/png");
 req.compositeImageBuffer = buffer;
 next();
}


async function sendImage(req, res, next) {
 res.setHeader("Content-Type", "image/png");
 res.send(req.compositeImageBuffer);
 next(); 
}

async function cleanupFiles(req, res, next) {
 fs.unlink(`./${req.identifier}-overlay.png`, () => {});
 fs.unlink(`./${req.identifier}-background.png`, () => {});
 fs.unlink(`./${req.identifier}-logo.png`, () => {});
 next();
}
