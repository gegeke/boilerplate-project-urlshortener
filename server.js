"use strict";

var express = require("express");
var mongo = require("mongodb");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");

var cors = require("cors");

var app = express();

// Basic Configuration
var port = process.env.PORT || 3000;

/** this project needs a db !! **/
// mongoose.connect(process.env.MONGOLAB_URI);
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });
var db = mongoose.connections[0];
var Schema = mongoose.Schema;

var counter = new Schema({
  seq: 0
});

var Counter = mongoose.model("Counter", counter);

var shortenedURL = new Schema({
  original_url: {
    type: String,
    required: true
  },
  short_url: Number
});

var Short = mongoose.model("Short", shortenedURL);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here

app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

app.use(bodyParser.urlencoded({ extended: false }));

app.post("/api/shorturl/new", async function(req, res, next) {
  var json = {};
  // regex source: https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url
  var regex = new RegExp(
    "(https?://(?:www.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9].[^s]{2,}|www.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9].[^s]{2,}|https?://(?:www.|(?!www))[a-zA-Z0-9]+.[^s]{2,}|www.[a-zA-Z0-9]+.[^s]{2,})",
    "gi"
  );
  if (!regex.test(req.body.url)) {
    json = { error: "invalid URL" };
  } else {
    var url = await getURL(req.body.url);
    if (url) {
      json = {
        original_url: url.original_url,
        short_url: url.short_url
      };
    } else {
      var { original_url, short_url } = await insertURL({
        original_url: req.body.url,
        short_url: await getNextSequence("shorturlcounter")
      });
      json = { original_url, short_url };
    }
  }

  res.json(json);
  next();
});

app.get("/api/shorturl/:id", async function(req, res, next) {
  if (isNaN(req.params.id)) {
    res.json({ error: "invalid short URL parameter" });
  } else {
    var response = await getShortURL(req.params.id);
    if (!response) {
      res.json({ error: "invalid short URL" });
    } else {
      var { original_url } = response;
      res.redirect(original_url);
    }
  }

  next();
});

// get the URL from the database
var getShortURL = function(short_url) {
  return Short.findOne({ short_url });
};

// get the URL from the database
var getURL = function(original_url) {
  return Short.findOne({ original_url });
};

// insert the URL document into the shorts collection
var insertURL = function(data) {
  var short = new Short(data);

  return short.save();
};

// get the next available "short URL" (number)
var getNextSequence = async function(name) {
  var ret = await db.collections.counters.findOneAndUpdate(
    { _id: "shorturlcounter" },
    { $inc: { seq: 1 } }
  );

  return ret.value.seq;
};

app.listen(port, function() {
  console.log("Node.js listening ...");
});
