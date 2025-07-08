const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { default: PlantInfo } = require("./plantInfo.model");

const app = express();
app.use(express.json());

const port = 8080;

const IMAGES_FOLDER = "./static";
const PLANTS_FILE = "./plants.json";

if (!fs.existsSync(IMAGES_FOLDER)) {
    fs.mkdirSync(IMAGES_FOLDER);
}

app.use("/static", express.static("static"));

// Configure multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, IMAGES_FOLDER); // Where to save
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + file.originalname;
        cb(null, uniqueName); // Save with unique filename
    },
});

// Only accept image files
const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const isValid = allowed.test(file.mimetype);
    cb(null, isValid);
};

const upload = multer({ storage, fileFilter });

/**
 * @returns{PlantInfo[]}
 */
function loadPlants() {
    if (!fs.existsSync(PLANTS_FILE)) {
        return [];
    }

    try {
        const data = fs.readFileSync(PLANTS_FILE, "utf8");
        const plants = PlantInfo.fromJSON(data);
        for (let index = 0; index < plants.length; index++) {
            const plant = plants[index];
            if (plant.id > PlantInfo.lastID) {
                PlantInfo.lastID = plant.id;
            }
        }
        return plants;
    } catch (err) {
        console.error(err);
    }
}

/**
 *
 * @param {PlantInfo[]} plants
 */
function storePlants(plants) {
    fs.writeFileSync(PLANTS_FILE, JSON.stringify(plants, null, 4));
}
/*
- uploadImage/:id
*/

app.post("/plants", (req, res) => {
    const plants = loadPlants();
    plants.push(new PlantInfo(req.body.name));
    storePlants(plants);
    res.status(201).send("Plant created");
});

app.put("/plants/:id", (req, res) => {
    const plants = loadPlants();
    const plantIdx = plants.findIndex((p) => p.id == req.params.id);
    if (plantIdx === -1) {
        res.status(404).send("Plant not found");
        return;
    }
    plants[plantIdx].name = req.body.name;
    storePlants(plants);
    res.status(200).send("Plant updated");
});

app.put("/plants/:id/water", (req, res) => {
    const plants = loadPlants();
    const plantIdx = plants.findIndex((p) => p.id == req.params.id);
    if (plantIdx === -1) {
        res.status(404).send("Plant not found");
        return;
    }
    plants[plantIdx].lastWatered = new Date();
    storePlants(plants);
    res.status(201).send("Plant created");
});

app.delete("/plants/:id", (req, res) => {
    const plants = loadPlants();
    const plantIdx = plants.findIndex((p) => p.id == req.params.id);
    if (plantIdx === -1) {
        res.status(404).send("Plant not found");
        return;
    }
    storePlants(plants.filter((p) => p != req.params.id));
    res.status(200).send("Plant deleted");
});

app.put("/images/:id", upload.single("image"), (req, res) => {
    // TODO: DELETE OLD IMAGE
    if (!req.file) {
        return res.status(400).send("Invalid file type.");
    }
    res.send({
        message: "Upload successful",
        filename: req.file.filename,
        path: `/images/${req.file.filename}`,
    });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
