const express = require("express");
const app = express();
const path = require("path");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const multer = require("multer");
const GridFsStorage = require("multer-gridfs-storage").GridFsStorage;
const Grid = require("gridfs-stream")
const methodOverride = require("method-override");
const dotenv = require("dotenv");

dotenv.config();

const conn = mongoose.createConnection(process.env.MONGO_URI, () => console.log("DB IS CONNECTED!"));

mongoose.connection.on("error", err => { console.log("CONNECTION ERROR!") });

let gfs;

conn.once('open', () => {
    gfs = Grid(conn.db, mongoose.mongo);
    gfs.collection("uploads");
})

const storage = new GridFsStorage({
    url: process.env.MONGO_URI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                };
                resolve(fileInfo);
            });
        });
    }
});

//tried to add a few size and image constraints.

//const maxSize = 1 * 1024 * 1024;
const upload = multer({ storage });

/*const upload = multer({
    storage: storage, fileFilter: (req, file, cb) => {
        if (file.mimetype == "/image/png" ||
            file.mimetype == "/image/jpg" ||
            file.mimetype == "/image/jpeg"
        ) { cb(null, true); }
        else {
            cb(null, false);
            return cb(new Error("Only .png .jpg and .jpeg files are allowed with a size Limit of 1 MB"))
        }

    },
    limits: { fileSize: maxSize }
})*/


app.use(bodyParser.json());
app.use(methodOverride("_method"));
app.set("view engine", "ejs");


app.get("/", (req, res) => {

    gfs.files.find().toArray((err, files) => {

        if (!files || files.length == 0) {
            res.render("index", { files: false });
        }
        else {
            files.map(file => {
                if (file.contentType === "image/jpeg" || file.contentType === "image/png") {

                    file.isImage = true;
                }
                else {
                    file.isImage = false;
                }
            });
            res.render("index", { files: files })
        }

    });
});


app.post("/upload", upload.single("file"), (req, res) => {

    res.json({ file: req.file.id });

    /*upload(req, res, function (err) {

        if (err instanceof multer.MulterError) {
            res.send(err);
        } else if (err) {
            res.send(err)
        }
    })*/

});

app.get("/files", (req, res) => {

    gfs.files.find().toArray((err, file) => {

        if (!file || file.length == 0) {

            return res.status(404).json({

                err: "No File Exists!"
            });
        }
        return res.json(file);

    });
})

app.get("/files/:filename", (req, res) => {

    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {

        if (!file || file.length == 0) {
            return res.status(404).json({

                err: "No files exist!"
            });
        }
        return res.json(file);
    })
})

app.get("/image/:filename", (req, res) => {

    gfs.files.findOne({ filename: req.params.filename }, (err, file) => {

        if (!file || file.length == 0) {
            return res.status(404).json({

                err: "No files exist!"
            });
        }

        if (file.contentType === "image/jpeg" || file.contentType === "image/png") {

            const readstream = gfs.createReadStream(file.filename);
            readstream.pipe(res);
        } else {
            res.status(404).json({

                err: "Not an image"
            })
        }
    })
})

app.delete('/files/:id', (req, res) => {
    gfs.remove({ _id: req.params.id, root: 'uploads' }, (err, gridStore) => {
        if (err) {
            return res.status(404).json({ err: err });
        }

        res.redirect('/');
    });
});

const port = process.env.PORT;

app.listen(port, () => console.log(`SERVER IS UP AND RUNNING ON  PORT : ${port}`));