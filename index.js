const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
var cors = require("cors");
const router = express();
const port = process.env.PORT || 3000;
const key = process.env.CLOUD_KEY;

const corsOptions = {
  origin: "*",
  methods: ["POST"],
  allowedHeaders: ["Content-Type"],
};

router.use(cors(corsOptions));
router.use(bodyParser.json({ limit: "50mb" }));
// router.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

router.get("/", (req, res) => {
  res.json({
    hello: "hi!",
  });
});

router.post("/", async (req, res, next) => {
  try {
    res.send(
      await main(
        req.body.img,
        req.body.incomeLanguage,
        req.body.outcomeLanguage
      )
    );
  } catch (ex) {
    next(ex);
  }
});

//main
async function main(imageBase64, incomeLanguage, outcomeLanguage) {
  const response = await getText(incomeLanguage, imageBase64);
  let rowBlocks = [];
  // console.log(response.language);
  for (let block of response.blocks) {
    await translateBlocks(rowBlocks, block, incomeLanguage, outcomeLanguage);
  }
  return { rowBlocks: rowBlocks, language: response.language };
}

//Get text blocks
const getText = async (incomeLanguage, imageBase64) => {
  return axios
    .post(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      requests: [
        {
          image: {
            content: imageBase64,
          },
          features: [
            {
              type: "TEXT_DETECTION",
            },
          ],
          imageContext: {
            languageHints: [incomeLanguage],
          },
        },
      ],
    })
    .then((response) => {
      return {
        blocks: response.data.responses[0].fullTextAnnotation.pages[0].blocks,
        language:
          response.data.responses[0].fullTextAnnotation.pages[0].property
            .detectedLanguages,
      };
    });
};

//translate text blocks
async function translateBlocks(
  rowBlocks,
  block,
  incomeLanguage,
  outcomeLanguage
) {
  const currBlock = {};
  currBlock.vertices = block.boundingBox.vertices;
  let text = "";
  let fontSize = "";
  let counter = 0;
  for (let i = 0; i < block.paragraphs.length; i++) {
    block.paragraphs[i].words.map((word) => {
      word.symbols.map((symbol) => {
        if ((fontSize == "" && symbol.text.length == 1) || counter < 5) {
          fontSize = Math.max(
            Math.abs(
              symbol.boundingBox.vertices[0].y -
                symbol.boundingBox.vertices[2].y
            ),
            fontSize
          );
          counter++;
        }
        text += symbol.text;
      });
      const noSpaceLanguage = ["zh", "ja", "ko"];
      if (!noSpaceLanguage.includes(incomeLanguage)) {
        text += " ";
      }
    });
  }
  // console.log(text);
  text = await translateText(text, incomeLanguage, outcomeLanguage);
  currBlock.text = text;
  currBlock.fontSize = fontSize;
  rowBlocks.push(currBlock);
  return rowBlocks;
}

//translate text
const translateText = async (text, incomeLanguage, outcomeLanguage) => {
  return axios
    .post(
      `https://translation.googleapis.com/language/translate/v2?key=${key}`,
      {
        q: text,
        source: incomeLanguage,
        target: outcomeLanguage,
      }
    )
    .then((response) => {
      return response.data.data.translations[0].translatedText;
    });
};
router.listen(port, () => console.log(`listening on port ${port}`));
