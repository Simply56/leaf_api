const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");

const tinify = require("tinify");
tinify.key = "PJKGghx7hhZpt5TCyGXDNCKgNTKd2yMK";

const port = 5000;
const IMAGES_FOLDER = "./static";
const PLANTS_FILE = "./plants.json";
const ORACLE_VPS_IP = "152.67.64.149";
const DEFAULT_IMAGE_PATH = IMAGES_FOLDER + "/defaultPlant.png";
console.log(DEFAULT_IMAGE_PATH);

class PlantInfo {
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

    /**
     * @param {Object} plainPlant
     * @param {string} name
     */
    constructor(plainPlant = undefined, name = undefined) {
        // XOR - exactly one must be defined
        if (xor(plainPlant != undefined, name != undefined)) {
            if (name != undefined) {
                // Creating a brand new plant with a new id
                const plants = loadPlants();
                this.id =
                    plants.reduce(
                        (prevMax, plant) => Math.max(prevMax, plant.id),
                        0
                    ) + 1;

                this.name = name;
                this.lastWatered = undefined;
                this.imagePath = DEFAULT_IMAGE_PATH;
            }
            // Reconstructing a plant from JSON
            if (plainPlant != undefined) {
                this.id = plainPlant.id;
                this.name = plainPlant.name;
                this.lastWatered = plainPlant.lastWatered;
                this.imagePath = plainPlant.imagePath;
            }
            return this;
        }

        throw new Error(
            "Exactly one argument must be defined when creting plant"
        );
    }

    /**
     * Converts a JSON string into a PlantInfo instances using a reviver
     * @param {string} jsonString
     * @returns {PlantInfo[]}
     */
    static fromJSON(jsonString) {
        const result = [];
        const plainPlants = JSON.parse(jsonString);
        for (let index = 0; index < plainPlants.length; index++) {
            const plainPlant = plainPlants[index];
            const newPlant = new PlantInfo(plainPlant);
            // console.log("from Json:", newPlant);

            if (plainPlant.imagePath != null) {
                newPlant.imagePath = plainPlant.imagePath;
            }
            if (plainPlant.lastWatered != null) {
                newPlant.lastWatered = new Date(plainPlant.lastWatered);
            }
            result.push(newPlant);
        }

        return result;
    }
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan("combined"));

// removes leading dot from imagePath middleware
app.use((req, res, next) => {
    // Store the original res.json method
    const originalJson = res.json;

    // Override res.json to modify the response
    res.json = function (body) {
        if (!JSON.stringify(body).includes("imagePath")) {
            return originalJson.call(this, body);
        }
        // Deep traverse and modify imagePath properties
        const modifiedBody = deepModifyImagePath(body);

        // Call the original res.json with modified body
        return originalJson.call(this, modifiedBody);
    };

    next();
});

function deepModifyImagePath(obj) {
    // Handle null or undefined
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map((item) => deepModifyImagePath(item));
    }

    // Handle objects
    if (typeof obj === "object") {
        const result = {};

        for (const [key, value] of Object.entries(obj)) {
            if (
                key === "imagePath" &&
                typeof value === "string" &&
                value.length > 0
            ) {
                // Remove the first character from imagePath
                result[key] = value.substring(1);
            } else {
                // Recursively process nested objects/arrays
                result[key] = deepModifyImagePath(value);
            }
        }

        return result;
    }

    // Return primitive values as-is
    return obj;
}

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
    return [];
}

/**
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

// get plant by id
app.get("/plants/:id", (req, res) => {
    const plants = loadPlants();
    const targetPlant = plants.find((p) => p.id == req.params.id);
    if (targetPlant == undefined) {
        res.status(404).send({ message: "Plant not found" });
        return;
    }
    res.status(200).send(targetPlant);
});

// create plant
app.post("/plants", (req, res) => {
    const plants = loadPlants();
    plants.push(new PlantInfo(undefined, req.body.name));
    // console.log("new Plant:", plants[plants.length - 1]);
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
    res.status(201).send({ message: "Plant watered" });
    plant.lastWatered = new Date(req.body.ISODate);
    storePlants(plants);
});

// delete plant
app.delete("/plants/:id", (req, res) => {
    const plants = loadPlants();
    const removeIdx = plants.findIndex((p) => p.id == req.params.id);
    if (removeIdx === -1) {
        res.status(404).send({ message: "Plant not found" });
        return;
    }
    if (plants[removeIdx].imagePath !== DEFAULT_IMAGE_PATH) {
        fs.unlinkSync(plants[removeIdx].imagePath);
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
    const newPath = `${IMAGES_FOLDER}/${getRandomInt(
        1_000_000
    )}.${req.file.originalname.split(".").pop()}`;
    fs.renameSync(originalPath, newPath);

    const plant = plants.find((p) => p.id == req.params.id);
    if (plant) {
        plant.imagePath = newPath;
    } else {
        res.statusCode(404).send({ message: "Plant not found" });
    }
    storePlants(plants);
    res.send({
        message: "Upload successful",
        newPath: newPath,
    });
    const source = tinify.fromFile(plant.imagePath);
    const resized = source.resize({ method: "cover", width: 500, height: 500 });
    resized.toFile(plant.imagePath);
});

// for discovery on the lan
app.get("/ping", (req, res) => {
    res.send({ uuid: "73182a69-3fdf-4b5a-900a-e5369803afbb" });
});

app.listen(port, "0.0.0.0", () => {
    console.log(
        `App listening on http://localhost:${port} and http://${ORACLE_VPS_IP}:${port}`
    );
});

// utils
/**
 * @param {boolean} a
 * @param {boolean} b
 */
function xor(a, b) {
    return (a && !b) || (!a && b);
}

/**
 * @param {number} max
 */
function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}
