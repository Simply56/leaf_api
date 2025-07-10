const express = require("express");
const multer = require("multer");
const cors = require("cors"); // Import the cors middleware
const fs = require("fs");

class PlantInfo {
    static lastID = -1;

    /**
     * @type {number} id - used to identify the plant
     */
    id;
    /**
     * @type {string} imagePath - path to the plant image
     */
    imagePath;

    /**
     * @type {Date | undefined} imagePath - path to the plant image
     */
    lastWatered;

    /**
     * @type {string} imagePath - path to the plant image
     */
    name;

    constructor(name, id = -1) {
        if (id > PlantInfo.lastID) {
            PlantInfo.lastID = id - 1;
        }
        if (id === -1) {
            this.id = ++PlantInfo.lastID;
        } else {
            this.id = id;
        }

        this.name = name;
        this.lastWatered = undefined;
        this.imagePath = "./static/defaultPlant.png";
    }

    /**
     * Converts a JSON string into a PlantInfo instances using a reviver
     * @param {string} json
     * @returns {PlantInfo[]}
     */
    static fromJSON(jsonString) {
        const result = [];
        const array = JSON.parse(jsonString);
        for (let index = 0; index < array.length; index++) {
            const element = array[index];
            const newPlant = new PlantInfo(element.name, element.id);

            if (element.imagePath != null) {
                newPlant.imagePath = element.imagePath;
            }
            if (element.lastWatered != null) {
                newPlant.lastWatered = new Date(element.lastWatered);
            }
            result.push(newPlant);
        }

        return result;
    }
}

const app = express();
app.use(express.json());
app.use(cors());

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
        const uniqueName = file.originalname;
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

// get all plants
app.get("/plants", (req, res) => {
    const plants = loadPlants();
    res.status(200).send(plants);
});

// create plant
app.post("/plants", (req, res) => {
    const plants = loadPlants();
    plants.push(new PlantInfo(req.body.name));
    storePlants(plants);
    res.status(201).send({ message: "Plant created" });
});

// rename plant
app.put("/plants/:id", (req, res) => {
    const plants = loadPlants();
    const plantIdx = plants.findIndex((p) => p.id == req.params.id);
    if (plantIdx === -1) {
        res.status(404).send({ message: "Plant not found" });
        return;
    }
    plants[plantIdx].name = req.body.name;
    storePlants(plants);
    res.status(200).send({ message: "Plant updated" });
});

// water plant
app.put("/plants/:id/water", (req, res) => {
    const plants = loadPlants();
    const plant = plants.find((p) => p.id == req.params.id);
    if (!plant) {
        res.status(404).send({ message: "Plant not found" });
        return;
    }
    plant.lastWatered = new Date();
    storePlants(plants);
    res.status(201).send({ message: "Plant watered" });
});

// delete plant
app.delete("/plants/:id", (req, res) => {
    const plants = loadPlants();
    const removeIdx = plants.findIndex((p) => p.id == req.params.id);
    if (removeIdx === -1) {
        res.status(404).send({ message: "Plant not found" });
        return;
    }
    const newPlants = [];
    for (let index = 0; index < plants.length; index++) {
        const plant = plants[index];
        if (index === removeIdx) {
            continue;
        }
        newPlants.push(plant);
    }
    storePlants(newPlants);
    res.status(200).send({ message: "Plant deleted" });
});

// update plant image
app.put("/images/:id", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: "Invalid file type." });
    }
    const plants = loadPlants();

    const originalPath = `${IMAGES_FOLDER}/${req.file.filename}`;
    const newPath = `${IMAGES_FOLDER}/${req.params.id}.${req.file.originalname
        .split(".")
        .pop()}`;
    fs.renameSync(originalPath, newPath);

    const plant = plants.find((p) => p.id == req.params.id);
    if (plant) {
        plant.imagePath = newPath;
    }
    storePlants(plants);
    res.send({
        message: "Upload successful",
    });
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
