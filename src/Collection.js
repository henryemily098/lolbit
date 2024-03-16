class Collection extends Map {
    constructor() {
        super();
    }

    /**
     * 
     * @param {number} index 
     * @returns
     */
    at(index) {
        let array = Array.from(this.values());
        return array[index];
    }

    /**
     * 
     * @param {Function} callback 
     * @returns
     */
    filter(callback) {
        return Array.from(this.values()).filter(callback);
    }

    /**
     * 
     * @param {Function} callback 
     * @returns 
     */
    map(callback) {
        return Array.from(this.values()).map(callback);
    }

    /**
     * 
     * @param {Function} callback 
     * @returns 
     */
    sort(callback) {
        let array = Array.from(this);
        return array.sort(callback);
    }

    toJSON() {
        return Array.from(this.values());
    }
}

module.exports = Collection;