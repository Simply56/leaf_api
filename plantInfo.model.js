/**
 * @param
 */
export default class PlantInfo {
    static lastID = 0;

    /**
     * @type {number} id - used to identify the plant
     */
    id;
    /**
     * @type {string} imagePath - path to the plant image
     */
    imagePath = "./static/defaultPlant.png";

    /**
     * @type {Date | undefined} imagePath - path to the plant image
     */
    lastWatered;

    /**
     * @type {string} imagePath - path to the plant image
     */
    name;

    constructor(name) {
        this.id = PlantInfo.lastID++;
        name = name;
    }

    /**
     * Converts a JSON string into a PlantInfo instances using a reviver
     * @param {string} json
     * @returns {PlantInfo[]}
     */
    static fromJSON(jsonString) {
        // Parse the JSON string once — it should represent an array of objects
        const arr = JSON.parse(jsonString, (key, value) => {
            if (key === "lastWatered" && value) {
                return new Date(value);
            }
            return value;
        });

        // Map each plain object to a PlantInfo instance
        return arr.map((obj) => Object.assign(new PlantInfo(), obj));
    }
}
