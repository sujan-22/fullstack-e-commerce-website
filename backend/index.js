const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { type } = require("os");
const { error, log } = require("console");

app.use(express.json());
app.use(cors());

//  DATABASE CONNECTION WITH MONGODB
mongoose.connect(
  "mongodb+srv://sujanrokad44:sujanrokad22@cluster0.lwxury0.mongodb.net/e-commerce"
);

// API CREATION

app.get("/", (req, res) => {
  res.send("Express app is running");
});

// IMAGE STORAGE ENGINE

const storage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: storage });

// CREATING UPLOAD ENDPOINT FOR IMAGES

app.use("/images", express.static("upload/images"));

app.post("/upload", upload.single("product"), (req, res) => {
  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`,
  });
});

// SCHEMA FOR CREATING PRODUCTS

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now(),
  },
  available: {
    type: Boolean,
    default: true,
  },
});

app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;

  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }
  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });
  console.log(product);
  await product.save();
  console.log("saved");
  res.json({ success: true, name: req.body.name });
});

// CREATING API FOR DELETING PRODUCTS

app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("removed");
  res.json({ success: true, name: req.body.name });
});

// CREATING API FOR GETTING ALL PRODUCTS
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  console.log("all products fetched");
  res.send(products);
});

//  SCHEMA CREATING FOR USER MODEL

const Users = mongoose.model("Users", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  data: {
    type: Date,
    defaulr: Date.now(),
  },
});

// CREATING END POINT FOR REGISTERING USER

app.post("/signup", async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: false,
      errors: "Existing user found with same email address already",
    });
  }

  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }

  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// CREATING ENDPOINT FOR USER LOGIN

app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong password" });
    }
  } else {
    res.json({ success: false, errors: "Wrong email" });
  }
});

// CREATING ENDPOINT FOR NEWCOLLECTION DATA
app.get("/newcollections", async (req, res) => {
  try {
    // Fetch random 8 products
    let newcollection = await Product.aggregate([{ $sample: { size: 8 } }]);

    console.log("new collection fetched");
    res.send(newcollection);
  } catch (error) {
    console.error("Error fetching new collection:", error);
    res.status(500).json({ success: false, errors: "Internal Server Error" });
  }
});

// CREATING ENDPOINT FOR POPULAR IN WOMEN SECTION
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let popularinwomen = products.slice(0, 4);
  res.send(popularinwomen);
});

// CREATING MIDDLEWARE TO FETCH USER
const fetchUser = async (req, res, next) => {
  const token = req.header("auth_token");
  if (!token) {
    res.status(401).send({ errors: "Please authenticate using valid token" });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (err) {
      res.status(401).send({ errors: err.message });
    }
  }
};

// CREATING ENDPOINT FOR ADDING PRODUCTS IN CART
app.post("/addtocart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added");
});

// CREATING TO REMOVE PRODUCTS FROM CART DATA
app.post("/removefromcart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0) {
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate(
      { _id: req.user.id },
      { cartData: userData.cartData }
    );
    res.send("Removed");
  }
});

// CREATING ENDPOINT TO GET CART DATA
app.post("/getcart", fetchUser, async (req, res) => {
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// Schema for newsletter subscriptions
const NewsletterSubscription = mongoose.model("NewsletterSubscription", {
  email: {
    type: String,
    unique: true,
  },
});

// Endpoint for subscribing to the newsletter
app.post("/subscribe", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the email is already subscribed
    const existingSubscription = await NewsletterSubscription.findOne({
      email,
    });
    if (existingSubscription) {
      return res
        .status(400)
        .json({ success: false, errors: "Email is already subscribed." });
    }

    // Create a new subscription record
    const newSubscription = new NewsletterSubscription({ email });
    await newSubscription.save();
    console.log("New subscription");
    res.json({ success: true, message: "Subscribed successfully." });
  } catch (error) {
    console.error("Error subscribing to the newsletter:", error);
    res.status(500).json({ success: false, errors: "Internal Server Error" });
  }
});

app.listen(port, (error) => {
  if (!error) {
    console.log("Server running on port " + port);
  } else {
    console.log("Error: " + error);
  }
});
