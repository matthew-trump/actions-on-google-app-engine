const RANKING = {
    FIRST: "FIRST",
    GENERIC: "GENERIC",
    THIRD: "THIRD",
    HALF_WAY: "HALF_WAY",
    NEXT_TO_NEXT_TO_NEXT_TO_LAST: "NEXT_TO_NEXT_TO_NEXT_TO_LAST",
    NEXT_TO_NEXT_TO_LAST: "NEXT_TO_NEXT_TO_LAST",
    NEXT_TO_LAST: "NEXT_TO_LAST",
    LAST: "LAST"
}

class utils {
    getItemRanking(index, length) {
        if (index === 0) {
            return RANKING.FIRST;
        }
        if (index === length - 1) {
            return RANKING.LAST;
        }
        if (length > 3) {
            if (index === length - 2) {
                return RANKING.NEXT_TO_LAST;
            }
        }
        if (length > 4) {
            if (index === Math.floor(length / 2)) {
                return RANKING.HALF_WAY;
            }
        }
        if (length > 5) {
            if (index === 2) {
                return RANKING.THIRD;
            }
        }
        if (length > 6) {
            if (index === length - 3) {
                return RANKING.NEXT_TO_NEXT_TO_LAST;
            }
        }
        if (length > 7) {
            if (index === length - 4) {
                return RANKING.NEXT_TO_NEXT_TO_NEXT_TO_LAST;
            }
        }
        return RANKING.GENERIC;
    }
    escape(value) {
        if (value && typeof value === "string") {
            return value.replace(/&/g, "&amp;");
        }
        return value;
    }
    getRandomIndex(max) {
        return Math.floor(Math.random() * max)
    }

}

module.exports = { Utils: new utils(), RANKING };