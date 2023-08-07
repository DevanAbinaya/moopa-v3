import {
  createList,
  getEpisode,
  updateUserEpisode,
} from "../../../../prisma/user";

export default async function handler(req, res) {
  try {
    switch (req.method) {
      case "POST": {
        const { name, id } = JSON.parse(req.body);

        // console.log(name, id);
        const episode = await createList(name, id);
        if (!episode) {
          return res
            .status(200)
            .json({ message: "Episode is already created" });
        } else {
          return res.status(201).json(episode);
        }
      }
      case "PUT": {
        const { name, id, title, image, number, duration, timeWatched } =
          JSON.parse(req.body);
        const episode = await updateUserEpisode({
          name,
          id,
          title,
          image,
          number,
          duration,
          timeWatched,
        });
        if (!episode) {
          return res.status(200).json({ message: "Episode is already there" });
        } else {
          return res.status(200).json(episode);
        }
      }
      case "GET": {
        const { id, name } = req.body;
        const episode = await getEpisode(name);
        if (!episode) {
          return res.status(404).json({ message: "Episode not found" });
        } else {
          return res.status(200).json(episode);
        }
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}