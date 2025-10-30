import app from "../src/app.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  return app(req, res);
}
