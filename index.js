const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const objectId = require('mongodb').ObjectId;

const app = express();
const port = process.env.PORT || 8000;

// middleware
app.use(cors());
app.use(express.json());


const uri = "mongodb+srv://samuraiDB:ByZjhHkBc4WvIWyY@cluster0.ssi7z.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const database = client.db("stationDB");
        const usersCollection = database.collection("users");
        const stationCollection = database.collection("stations");
        const trainsCollection = database.collection("trains");
        const ticketsCollection = database.collection("tickets");




        app.post('/api/users', async (req, res) => {
            const { user_id, user_name, balance } = req.body;

            try {
                const existingUser = await usersCollection.findOne({ user_id: user_id });

                if (existingUser) {
                    // Book with the same ID already exists
                    res.status(400).send({ message: `user with the same ID ${user_id}  already exists` });
                } else {
                    const newUser = { user_id, user_name, balance };
                    const result = await usersCollection.insertOne(newUser);

                    // Remove _id field from the response
                    delete newUser._id;

                    res.status(201).send(newUser);
                }
            } catch (error) {
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.post('/api/stations', async (req, res) => {
            const { station_id, station_name, longitude, latitude } = req.body;

            try {
                const existingStation = await stationCollection.findOne({ station_id: station_id });

                if (existingStation) {
                    // Book with the same ID already exists
                    res.status(400).send({ message: `station with the same ID ${station_id}  already exists` });
                } else {
                    const newStation = { station_id, station_name, longitude, latitude };
                    const result = await stationCollection.insertOne(newStation);

                    // Remove _id field from the response
                    delete newStation._id;

                    res.status(201).send(newStation);
                }
            } catch (error) {
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });


        app.post('/api/trains', async (req, res) => {
            const { train_id, train_name, capacity, stops } = req.body;

            try {
                const existingTrain = await trainsCollection.findOne({ train_id: train_id });

                if (existingTrain) {
                    res.status(400).send({ message: `Train with the same ID ${train_id} already exists` });
                } else {
                    // Validate the stops data structure before inserting
                    if (!Array.isArray(stops) || stops.length === 0) {
                        res.status(400).send({ message: 'Invalid stops data structure' });
                        return;
                    }

                    // Convert 'null' values to undefined for proper insertion
                    const sanitizedStops = stops.map(stop => {
                        return {
                            station_id: stop.station_id,
                            arrival_time: stop.arrival_time === 'null' ? undefined : stop.arrival_time,
                            departure_time: stop.departure_time === 'null' ? undefined : stop.departure_time,
                            fare: stop.fare
                        };
                    });

                    // Insert the new train data into the collection
                    const newTrainData = { train_id, train_name, capacity, stops: sanitizedStops }; // Use the same names as in the parameter destructuring
                    const result = await trainsCollection.insertOne(newTrainData);

                    // Extract relevant information for the response
                    const { train_id: responseTrainId, train_name: responseTrainName, capacity: responseCapacity } = newTrainData;
                    const service_start = sanitizedStops[0].departure_time;
                    const service_ends = sanitizedStops[sanitizedStops.length - 1].arrival_time;
                    const num_stations = sanitizedStops.length;

                    // Send the response with the desired structure
                    res.status(201).send({
                        train_id: responseTrainId,
                        train_name: responseTrainName,
                        capacity: responseCapacity,
                        service_start,
                        service_ends,
                        num_stations
                    });
                }
            } catch (error) {
                console.error(error); // Log the complete error object
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });


        app.get('/api/stations', async (req, res) => {
            try {
                // Fetch stations from the database
                const stations = await stationCollection.find({}).toArray();

                if (stations.length === 0) {
                    // If no stations, respond with an empty array
                    res.status(200).send({ stations: [] });
                } else {
                    // Remove _id field from each station in the response
                    const sanitizedStations = stations.map(station => {
                        const sanitizedStation = { ...station };
                        delete sanitizedStation._id;
                        return sanitizedStation;
                    });

                    // Respond with the stations array
                    res.status(200).send({ stations: sanitizedStations });
                }
            } catch (error) {
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        app.get('/api/stations/:station_id/trains', async (req, res) => {
            const stationId = parseInt(req.params.station_id);

            try {
                // Check if the station exists
                const existingStation = await stationCollection.findOne({ station_id: stationId });

                if (!existingStation) {
                    res.status(404).send({ message: `Station with id: ${stationId} was not found` });
                    return;
                }

                // Fetch trains for the station
                const trains = await trainsCollection
                    .find({ 'stops.station_id': stationId })
                    .sort({
                        'stops.departure_time': 1,
                        'stops.arrival_time': 1,
                        train_id: 1
                    })
                    .toArray();

                // Format the response
                const responseTrains = trains.map(train => {
                    return {

                        stops: train.stops.map(stop => {
                            return {
                                station_id: stop.station_id,
                                arrival_time: stop.arrival_time,
                                departure_time: stop.departure_time
                            };
                        })
                    };
                });

                const response = {
                    station_id: stationId,
                    trains: responseTrains
                };

                // Send the response
                res.status(200).send(response);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });



        app.get('/api/wallets/:wallet_id', async (req, res) => {
            const walletId = parseInt(req.params.wallet_id);

            try {
                // Find the user's wallet based on wallet ID
                const userWallet = await usersCollection.findOne({ user_id: walletId });

                if (!userWallet) {
                    // If the wallet does not exist, return a 404 status code with a message
                    res.status(404).send({ message: `Wallet with id: ${walletId} was not found` });
                    return;
                }

                // Construct the response model
                const response = {
                    wallet_id: walletId,
                    balance: userWallet.balance,
                    wallet_user: {
                        user_id: userWallet.user_id,
                        user_name: userWallet.user_name
                    }
                };

                // Respond with the constructed response model
                res.status(200).send(response);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });

        // wallet put method
        app.put('/api/wallets/:wallet_id', async (req, res) => {
            const walletId = parseInt(req.params.wallet_id);
            const { recharge } = req.body;

            try {
                // Find the user's wallet based on wallet ID
                const userWallet = await usersCollection.findOne({ user_id: walletId });

                if (!userWallet) {
                    // If the wallet does not exist, return a 404 status code with a message
                    res.status(404).send({ message: `Wallet with id: ${walletId} was not found` });
                    return;
                }

                // Validate recharge amount
                if (recharge < 100 || recharge > 10000) {
                    res.status(400).send({ message: `Invalid amount: ${recharge}` });
                    return;
                }

                // Update the wallet balance
                const updatedBalance = userWallet.balance + recharge;
                await usersCollection.updateOne({ user_id: walletId }, { $set: { balance: updatedBalance } });

                // Construct the response model
                const response = {
                    wallet_id: walletId,
                    balance: updatedBalance,
                    wallet_user: {
                        user_id: userWallet.user_id,
                        user_name: userWallet.user_name
                    }
                };

                // Respond with the constructed response model
                res.status(200).send(response);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Internal Server Error' });
            }
        });




















        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);






app.get('/', (req, res) => {
    res.send('Hello Samurai Book Store!');
});

app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});