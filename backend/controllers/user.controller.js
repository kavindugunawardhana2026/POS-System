'use strict';

const userService = require('../services/user.service');

async function list(req, res, next) {
  try {
    const data = await userService.listUsers(req.query);
    res.json({ success: true, ...data });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json({ success: true, data: user, message: 'User created successfully' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const user = await userService.updateUser(req.params.id, req.body);
    res.json({ success: true, data: user, message: 'User updated' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await userService.deleteUser(req.params.id, req.user.user_id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
}

async function setPin(req, res, next) {
  try {
    const result = await userService.setPin(req.params.id, req.body.pin);
    res.json(result);
  } catch (err) { next(err); }
}

async function clearPin(req, res, next) {
  try {
    const result = await userService.clearPin(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}

async function unlock(req, res, next) {
  try {
    const result = await userService.unlockUser(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = { list, getById, create, update, remove, setPin, clearPin, unlock };
