const { Request, Response, NextFunction} = require('express');
const path = require("path");

// Use the existing dishes data
const dishes = require(path.resolve("src/data/dishes-data"));

// Use this function to assign ID's when necessary
const nextId = require("../utils/nextId");

function hasDishId(req, res, next) {
    const { dishId } = req.params;
    if (dishId)  {
        res.locals.dishId = dishId;
        next();
    } else {
        next({
            status: 400,
            message: "A 'dishId' value parameter is required"
        });
    }
}

/**
 * Return a middleware function that checks for the given data value.
 * @param {string} prop The name of the data value to check for
 * @returns {(req: Request, res: Response, next: NextFunction) => void}
 */
function hasData(prop) {
    return (req, res, next) => {
        const { data = {} } = req.body;
        if (data[prop]) {
            res.locals[prop] = data[prop];
            next();
        } else {
            next({
                status: 400,
                message: `Dish must include a ${prop}`
            });
        }
    }
}

/**
 * Check the dish for valid price: integer >= 0
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next 
 */
function hasValidPrice(req, res, next) {
    const { data = {} } = req.body;
    const { price } = data;

    if (Number.isInteger(price) && price > 0) {
        res.locals.price = Number(price);
        return next();
    } else {
        return next({
            status: 400,
            message: "Dish must have a price that is an integer greater than 0"
        });
    }
}

/**
 * Ensure that the given :dishId from the route actually exists
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next 
 */
function dishExists(req, res, next) {
    const dishId = res.locals.dishId;
    const foundDishId = dishes.findIndex(dish => dish.id === dishId);
    if (foundDishId > -1) {
        res.locals.foundDishId = foundDishId
        res.locals.foundDish = dishes[foundDishId];
        next();
    } else {
        next({
            status: 404,
            message: `Dish does not exist: ${dishId}`
        });
    }
}

/**
 * Ensure that, if specified, the { id } in the data matches the :dishId from the route
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next 
 */
function idMatchesRoute(req, res, next) {
    const { dishId } = res.locals;
    const { data = {} } = req.body;
    if (data.id && data.id !== dishId) {
        next({
            status: 400,
            message: `Dish id does not match route id. Dish: ${data.id}, Route: ${dishId}`
        })
    } else {
        next()
    }
}

/**
 * List all dishes
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next 
 */
function listDishes(req, res, next) {
    res.json({ data: dishes });
}

/**
 * Get a single dish
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next 
 */
function getDish(req, res, next) {
    const { foundDish } = res.locals;
    res.json({ data: foundDish });
}

/**
 * Create a dish (the validity checks are in middleware)
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next 
 */
function createDish(req, res, next) {
    const { name, description, image_url, price } = res.locals;
    const dish = { id: nextId(), name, description, image_url, price };
    dishes.push(dish);
    res.status(201).json({ data: dish });
}

/**
 * Update the given dish (the validity checks are in middleware)
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next 
 */
function updateDish(req, res, next) {
    const { name, description, image_url, price, foundDish } = res.locals;
    Object.assign(foundDish, { name, description, image_url, price });
    res.json({ data: foundDish });
}

module.exports = {
    list: listDishes,
    create: [
        hasData('name'),
        hasData('description'), 
        hasData('image_url'), 
        hasValidPrice,
        createDish
    ],
    read: [
        hasDishId, 
        dishExists, 
        getDish
    ],
    update: [
        hasDishId, 
        dishExists, 
        hasData('name'),
        hasData('description'), 
        hasData('image_url'), 
        hasValidPrice,
        idMatchesRoute,
        updateDish
    ]
}