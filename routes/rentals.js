const express = require('express');
const { Transaction } = require('mongoose-transactions');
const { Rental, validate } = require('../models/rental');
const { Movie } = require('../models/movie');
const { Customer } = require('../models/customer');
const router = express.Router();

router.get('/', async (req, res) => {
    const rentals = await Rental.find().sort('-dateOut');
    res.send(rentals);
});

router.post('/', async (req, res) => {
    const { error } = validate(req.body);
    if(error) return res.status(400).send(error.details[0].message);

    const customer = await Customer.findById(req.body.customerId);
    if(!customer) return res.status(400).send('Invalid Customer');

    const movie = await Movie.findById(req.body.movieId);
    if(!movie) return res.status(400).send('Invalid Movie');

    if(movie.numberInStock === 0) return res.status(400).send('Movie not in stock.');

    let rental = new Rental({
        customer: {
            _id: customer._id,
            name: customer.name,
            phone: customer.phone
        },
        movie: {
            _id: movie._id,
            title: movie.title,
            dailyRentalRate: movie.dailyRentalRate
        }
    });

    const transaction = new Transaction();
    try{
        await transaction.start();
        rental = await transaction.insert(rental);
        await transaction.update(Movie, movie._id, { $inc: { numberInStock: -1 } }, {conditions: {numberInStock: {$gt: 0}}});
        await transaction.commit();
        res.send(rental);
    }
    catch (err) {
        await transaction.rollback();
        transaction.clean();
        res.status(500).send('Something went wrong while processing the rental.');
    }
});

module.exports = router;