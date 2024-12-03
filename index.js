const axios = require("axios");
const express = require("express");
const bodyParser = require("body-parser");
const async = require("async");
const commandQueue = async.queue((task, callback) => task(callback));
const fs = require("fs");
const crypto = require("crypto");
let accessToken = fs.readFileSync("accessToken.txt", "utf8");
accessToken = accessToken.trim();

const app = express();

const port = 9394;
const urls = [];
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.post("/add", (req, res) => {
  const { url, name } = req.body;
  urls.push({ url, name });
  res.send("Added to queue");
  console.log(`Added ${url} to queue`);
});
app.get("/", (req, res) => {
  if (!urls) {
    res.send("");
  }
  res.send(JSON.stringify(urls[0]));
  urls.shift();
});

app.get("/user", async (req, res) => {
  const profileSlug = req.query.profileSlug;
  const user = await axios.get(`https://api.iwara.tv/profile/${profileSlug}`);
  const idUser = user.data.user.id;
  const videoDetails = [];
  let page = 0;
  while (true) {
    const videos = await axios.get(
      `https://api.iwara.tv/videos?sort=date&page=${page}&user=${idUser}`,
    );
    if (videos.data.results.length === 0) {
      break;
    }
    videos.data.results.forEach((video) => {
      videoDetails.push({
        id: video.id,
        title: video.title,
      });
    });
    page++;
  }
  res.send(JSON.stringify(videoDetails));
});
app.get("/video", async (req, res) => {
  const videoId = req.query.id;
  res.send(
    JSON.stringify(
      await getVideoUrl("https://www.iwara.tv/video/" + videoId, accessToken),
    ),
  );
});
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
function convertToSHA1(str) {
  const shasum = crypto.createHash("sha1");
  shasum.update(str);
  return shasum.digest("hex");
}

function getJSON(url, callback, headers) {
  return axios
    .get(url, {
      headers: headers,
    })
    .then((res) => {
      return callback(null, res.data);
    })
    .catch((err, data) => {
      console.log("error: " + url);
      console.log(err);
      return null;
    });
}
async function getVideoUrl(url, accessToken) {
  const getID = (url) => {
    return url.match(/video\/([^\/]*)/)[1];
  };
  const getFileId = (url) => {
    return url.match(/file\/.+\?/g)[0].replace(/file\/|\?/g, "");
  };
  const getExpire = (url) => {
    return url.match("expires=.+&")[0].replace(/expires=|&/g, "");
  };

  const id = getID(url);
  if (!id) return null;
  try {
    return await getJSON(
      `https://api.iwara.tv/video/${id}`,
      async (status, res) => {
        if (status) {
          console.log("Error: ", status);
          return;
        }
        if (
          res.message &&
          (res?.message?.trim()?.toLowerCase()?.includes("notfound") ||
            res?.message?.trim()?.toLowerCase()?.includes("private"))
        ) {
          console.log(res.message + " for " + id);
          return;
        } else if (res.message) {
          console.log(res.message);
          return;
        }
        if (res.embedUrl && !res.fileUrl) {
          return res.embedUrl;
        }
        const fileUrl = res.fileUrl;
        const fileId = getFileId(fileUrl);
        if (!fileId || !fileUrl) {
          console.log("Not found requirement");
          return;
        }
        // const vidResolution = ["Source", "540", "360"];

        // console.log((fileId + '_' + getExpire(fileUrl) + '_5nFp9kmbNnHdAFhaqMvt'))
        return await getJSON(
          fileUrl,
          (status2, res2) => {
            const json = res2;
            let i = json.length - 1;
            while (
              i >= 0 &&
              !json[i].name.includes("Source") &&
              !json[i].name.includes("540") &&
              !json[i].name.includes("360")
            ) {
              i--;
            }
            const uri = "https:" + json[i].src.download;
            const resolution = json[i].name;
            return {
              url: uri,
              resolution: resolution,
              fileName: `[${resolution}] ${res.title}.mp4`,
            };
          },
          {
            "x-version": convertToSHA1(
              fileId + "_" + getExpire(fileUrl) + "_5nFp9kmbNnHdAFhaqMvt",
            ),
            Authorization: "Bearer " + accessToken,
          },
        );
      },
      {
        Authorization: "Bearer " + accessToken,
      },
    );
  } catch (ex) {
    console.log(ex);
  }
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
