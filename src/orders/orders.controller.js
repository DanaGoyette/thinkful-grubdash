const { Request, Response, NextFunction } = require("express");
const path = require("path");

// Use the existing order data
const orders = require(path.resolve("src/data/orders-data"));

// Use this function to assigh ID's when necessary
const nextId = require("../utils/nextId");

// This wasn't documented in the requirements!
// Had to infer it from the error message specified for when there's no status at all.
const VALID_STATUSES = [
  "pending",
  "preparing",
  "out-for-delivery",
  "delivered",
];

function hasOrderId(req, res, next) {
  const { orderId } = req.params;
  if (orderId) {
    res.locals.orderId = orderId;
    next();
  } else {
    next({
      status: 400,
      message: "An 'orderId' value parameter is required",
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
        message: `Order must include a ${prop}`,
      });
    }
  };
}

/**
 * Check the order for valid dishes: at least one present, and quantity is integer > 0;
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function hasValidDishes(req, res, next) {
  const { data = {} } = req.body;
  const dishes = data.dishes;
  if (!dishes) {
    return next({
      status: 400,
      message: "Order must include a dish",
    });
  }
  if (!Array.isArray(dishes) || !dishes.length) {
    return next({
      status: 400,
      message: "Order must include at least one dish",
    });
  }
  dishes.forEach((dish, index) => {
    const { quantity } = dish;
    if (!quantity || !Number.isInteger(quantity) || Number(quantity) < 1) {
      return next({
        status: 400,
        message: `Dish ${index} must have a quantity that is an integer greater than 0`,
      });
    }
  });
  res.locals.orders = orders;
  return next();
}

/**
 * Check the order for valid status: must be one of VALID_STATUSES, and cannot change 'delivered'
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function hasValidStatus(req, res, next) {
  const { status, foundOrder } = res.locals;
  if (!status || !VALID_STATUSES.includes(status)) {
    return next({
      status: 400,
      message: `Order must have a status of ${VALID_STATUSES.join(
        ", "
      )}; got: ${status}`,
    });
  } else if (foundOrder.status === "delivered") {
    return next({
      status: 400,
      message: "A delivered order cannot be changed",
    });
  }
  return next();
}

/**
 * Ensure that the specified :orderId from the route actually exists.
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function orderExists(req, res, next) {
  const orderId = res.locals.orderId;
  const foundIndex = orders.findIndex((order) => order.id === orderId);
  if (foundIndex > -1) {
    // Store the index so the delete operation doesn't have to redo the find.
    res.locals.foundIndex = foundIndex;
    res.locals.foundOrder = orders[foundIndex];
    next();
  } else {
    next({
      status: 404,
      message: `Order does not exist: ${orderId}`,
    });
  }
}

/**
 * Ensure that, if specified, the { id } in the data matches the :orderId from the route
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function idMatchesRoute(req, res, next) {
  const { orderId } = res.locals;
  const { data = {} } = req.body;
  if (data.id && data.id !== orderId) {
    // If the data contains an ID, it must match the route ID.
    next({
      status: 400,
      message: `Order id does not match route id. Order: ${data.id}, Route: ${orderId}`,
    });
  } else {
    next();
  }
}

/**
 * List all orders
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function listOrders(req, res, next) {
  res.json({ data: orders });
}

/**
 * Get a single order
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function getOrder(req, res, next) {
  const { foundOrder } = res.locals;
  res.json({ data: foundOrder });
}

/**
 * Create an order (the validity checks are in middleware)
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function createOrder(req, res, next) {
  const { deliverTo, mobileNumber, status } = res.locals;
  const order = { id: nextId(), deliverTo, mobileNumber, status };
  orders.push(order);
  res.status(201).json({ data: order });
}

/**
 * Update the given order (the validity checks are in middleware)
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function updateOrder(req, res, next) {
  const { deliverTo, mobileNumber, status, foundOrder } = res.locals;
  // Update all the fields of the order at once.
  Object.assign(foundOrder, { deliverTo, mobileNumber, status });
  res.json({ data: foundOrder });
}

/**
 * Delete an order (only if 'pending')
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
function deleteOrder(req, res, next) {
  const { foundIndex, foundOrder } = res.locals;
  if (foundOrder.status === "pending") {
    // Delete the order in-place
    orders.splice(foundIndex, 1);
    res.sendStatus(204);
  } else {
    next({
      status: 400,
      message: "An order cannot be deleted unless it is pending.",
    });
  }
}

module.exports = {
  list: listOrders,
  create: [
    hasData("deliverTo"),
    hasData("mobileNumber"),
    hasValidDishes,
    // hasValidStatus, // why do the tests expect invalid values to be allowed?
    createOrder,
  ],
  read: [hasOrderId, orderExists, getOrder],
  update: [
    hasOrderId,
    orderExists,
    idMatchesRoute,
    hasData("deliverTo"),
    hasData("mobileNumber"),
    hasData("status"),
    hasValidDishes,
    hasValidStatus,
    updateOrder,
  ],
  delete: [hasOrderId, orderExists, deleteOrder],
};
