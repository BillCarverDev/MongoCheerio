const express = require("express");
const router = express.Router();
const db = require("../models");
const request = require("request"); 
const cheerio = require("cheerio");
 
//GET route for scraping the NYT website
router.get("/scrape", (req, res) => {
    console.log("Scraping Init")
    //Grab the body of the HTML with request
    request("https://www.nytimes.com/", (error, response, body) => {
        if (!error && response.statusCode === 200) {
            //Load that into Cheerio and save it to $ for a shorthand selector
            const $ = cheerio.load(body);
            let count = 0;
            //Grab every article
            $('article').each(function (i, element) {
                //Save an empty result object
                let count = i;
                let result = {};
                //Add the text and href of every link, and summary and byline, saving them to object
                result.title = $(element)
                    .children('.story-heading')
                    .children('a')
                    .text().trim();
                result.link = $(element)
                    .children('.story-heading')
                    .children('a')
                    .attr("href");
                result.summary = $(element)
                    .children('.summary')
                    .text().trim()
                    || $(element)
                        .children('ul')
                        .text().trim();
                result.byline = $(element)
                    .children('.byline')
                    .text().trim()
                    || 'No byline available'
                
                if (result.title && result.link && result.summary){
                    //Create a new article using the `result` object built from scraping, but only if both values are present
                    db.Article.create(result)
                        .then(function (dbArticle) {
                            //View the added result in the console
                            count++;
                        })
                        .catch(function (err) {
                            //If an error occurred, send it to the client
                            return res.json(err);
                        });
                };
            });

            res.redirect('/')
        }
        else if (error || response.statusCode != 200){
            res.send("Scraping Error")
        }
    });
});

router.get("/", (req, res) => {
    db.Article.find({})
        .then(function (dbArticle) {
            //If successfully find articles, send them back to the client
            const retrievedArticles = dbArticle;
            let hbsObject;
            hbsObject = {
                articles: dbArticle
            };
            res.render("index", hbsObject);        
        })
        .catch(function (err) {
            //If an error occurred, send it to the client
            res.json(err);
        });
});

router.get("/saved", (req, res) => {
    db.Article.find({isSaved: true})
        .then(function (retrievedArticles) {
            //If successfully find articles, send them back to the client
            let hbsObject;
            hbsObject = {
                articles: retrievedArticles
            };
            res.render("saved", hbsObject);
        })
        .catch(function (err) {
            //If an error occurred, send it to the client
            res.json(err);
        });
});

//Route for getting all articles from the db
router.get("/articles", function (req, res) {
    //Grab every document in the articles collection
    db.Article.find({})
        .then(function (dbArticle) {
            //If successfully find articles, send them back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            //If an error occurred, send it to the client
            res.json(err);
        });
});

router.put("/save/:id", function (req, res) {
    db.Article.findOneAndUpdate({ _id: req.params.id }, { isSaved: true })
        .then(function (data) {
            //If successfully find articles, send them back to the client
            res.json(data);
        })
        .catch(function (err) {
            //If an error occurred, send it to the client
            res.json(err);
        });;
});

router.put("/remove/:id", function (req, res) {
    db.Article.findOneAndUpdate({ _id: req.params.id }, { isSaved: false })
        .then(function (data) {
            //If successfully find articles, send them back to the client
            res.json(data)
        })
        .catch(function (err) {
            //If an error occurred, send it to the client
            res.json(err);
        });
});

//Route for grabbing a specific article by id, populate it with its note
router.get("/articles/:id", function (req, res) {
    //Using the id passed in the id parameter, prepare a query that finds the matching one in the db
    db.Article.find({ _id: req.params.id })
        //Populate all of the notes associated with it
        .populate({
            path: 'note',
            model: 'Note'
        })
        .then(function (dbArticle) {
            //If successfully find an article with the given id, send it back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            //If an error occurred, send it to the client
            res.json(err);
        });
});

//Route for saving/updating an article's associated note
router.post("/note/:id", function (req, res) {
    //Create a new note and pass the req.body to the entry
    db.Note.create(req.body)
        .then(function (dbNote) {
            //If a note was created successfully, find one article with an `_id` equal to `req.params.id`, and update the article to be associated with the new note
            // { new: true } tells the query to return the updated user, returns the original by default
            //Since mongoose query returns a promise, chain another `.then` which receives the result of the query
            return db.Article.findOneAndUpdate({ _id: req.params.id }, {$push: { note: dbNote._id }}, { new: true });
        })
        .then(function (dbArticle) {
            //If successfully update an article, send it back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            //If an error occurred, send it to the client
            res.json(err);
        });
});

router.delete("/note/:id", function (req, res) {
    //Create a new note and pass the req.body to the entry
    db.Note.findByIdAndRemove({ _id: req.params.id })
        .then(function (dbNote) {

            return db.Article.findOneAndUpdate({ note: req.params.id }, { $pullAll: [{ note: req.params.id }]});
        })
        .then(function (dbArticle) {
            //If successfully update an article, send it back to the client
            res.json(dbArticle);
        })
        .catch(function (err) {
            //If an error occurred, send it to the client
            res.json(err);
        });
});

module.exports = router;
