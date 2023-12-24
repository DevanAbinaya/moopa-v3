import "@vidstack/react/player/styles/base.css";

import { useEffect, useRef, useState } from "react";

import style from "./player.module.css";

import {
  MediaPlayer,
  MediaProvider,
  useMediaStore,
  useMediaRemote,
  type MediaPlayerInstance,
  Track,
  MediaTimeUpdateEventDetail,
  MediaTimeUpdateEvent,
} from "@vidstack/react";
import { VideoLayout } from "./components/layouts/video-layout";
import { useWatchProvider } from "@/lib/context/watchPageProvider";
import { useRouter } from "next/router";
import { Subtitle } from "types/episodes/TrackData";
import useWatchStorage from "@/lib/hooks/useWatchStorage";
import { Sessions } from "types/episodes/Sessions";
import { useAniList } from "@/lib/anilist/useAnilist";

export interface Navigation {
  prev: Prev;
  playing: Playing;
  next: Next;
}

export interface Prev {
  id: string;
  title: string;
  img: string;
  number: number;
  description: string;
}

export interface Playing {
  id: string;
  title: string;
  description: string;
  img: string;
  number: number;
}

export interface Next {
  id: string;
  title: string;
  description: string;
  img: string;
  number: number;
}

type VidStackProps = {
  id: string;
  navigation: Navigation;
  userData: UserData;
  sessions: Sessions;
};

export type UserData = {
  id?: string;
  userProfileId?: string;
  aniId: string;
  watchId: string;
  title: string;
  aniTitle: string;
  image: string;
  episode: number;
  duration: number;
  timeWatched: number;
  provider: string;
  nextId: string;
  nextNumber: number;
  dub: boolean;
  createdAt: string;
};

type SkipData = {
  startTime: number;
  endTime: number;
  text: string;
};

export default function VidStack({
  id,
  navigation,
  userData,
  sessions,
}: VidStackProps) {
  let player = useRef<MediaPlayerInstance>(null);

  const {
    aspectRatio,
    setAspectRatio,
    track,
    playerState,
    dataMedia,
    autoNext,
  } = useWatchProvider();

  const { qualities, duration } = useMediaStore(player);

  const [getSettings, updateSettings] = useWatchStorage();
  const { marked, setMarked } = useWatchProvider();

  const { markProgress } = useAniList(sessions);

  const remote = useMediaRemote(player);

  const { defaultQuality = null } = track ?? {};

  const [chapters, setChapters] = useState<string>("");

  const router = useRouter();

  useEffect(() => {
    if (qualities.length > 0) {
      const sourceQuality = qualities.reduce(
        (max, obj) => (obj.height > max.height ? obj : max),
        qualities[0]
      );
      const aspectRatio = calculateAspectRatio(
        sourceQuality.width,
        sourceQuality.height
      );

      setAspectRatio(aspectRatio);
    }
  }, [qualities]);

  const [isPlaying, setIsPlaying] = useState(false);
  let interval: any;

  useEffect(() => {
    const plyr = player.current;

    function handlePlay() {
      // console.log("Player is playing");
      setIsPlaying(true);
    }

    function handlePause() {
      // console.log("Player is paused");
      setIsPlaying(false);
    }

    function handleEnd() {
      // console.log("Player ended");
      setIsPlaying(false);
    }

    plyr?.addEventListener("play", handlePlay);
    plyr?.addEventListener("pause", handlePause);
    plyr?.addEventListener("ended", handleEnd);

    return () => {
      plyr?.removeEventListener("play", handlePlay);
      plyr?.removeEventListener("pause", handlePause);
      plyr?.removeEventListener("ended", handleEnd);
    };
  }, [id, duration]);

  useEffect(() => {
    if (isPlaying) {
      interval = setInterval(async () => {
        const currentTime = player.current?.currentTime
          ? Math.round(player.current?.currentTime)
          : 0;

        const parsedImage = navigation?.playing?.img?.includes("null")
          ? dataMedia?.coverImage?.extraLarge
          : navigation?.playing?.img;

        if (sessions?.user?.name) {
          // console.log("updating user data");
          await fetch("/api/user/update/episode", {
            method: "PUT",
            body: JSON.stringify({
              name: sessions?.user?.name,
              id: String(dataMedia?.id),
              watchId: navigation?.playing?.id,
              title:
                navigation.playing?.title ||
                dataMedia.title?.romaji ||
                dataMedia.title?.english,
              aniTitle: dataMedia.title?.romaji || dataMedia.title?.english,
              image: parsedImage,
              number: Number(navigation.playing?.number),
              duration: duration,
              timeWatched: currentTime,
              provider: track?.provider,
              nextId: navigation?.next?.id,
              nextNumber: Number(navigation?.next?.number),
              dub: track?.isDub ? true : false,
            }),
          });
        }

        updateSettings(navigation?.playing?.id, {
          aniId: String(dataMedia.id),
          watchId: navigation?.playing?.id,
          title:
            navigation.playing?.title ||
            dataMedia.title?.romaji ||
            dataMedia.title?.english,
          aniTitle: dataMedia.title?.romaji || dataMedia.title?.english,
          image: parsedImage,
          episode: Number(navigation.playing?.number),
          duration: duration,
          timeWatched: currentTime, // update timeWatched with currentTime
          provider: track?.provider,
          nextId: navigation?.next?.id,
          nextNumber: navigation?.next?.number,
          dub: track?.isDub ? true : false,
          createdAt: new Date().toISOString(),
        });
        // console.log("update");
      }, 5000);
    } else {
      clearInterval(interval);
    }

    return () => {
      clearInterval(interval);
    };
  }, [isPlaying, sessions?.user?.name, track?.isDub, duration]);

  useEffect(() => {
    const autoplay = localStorage.getItem("autoplay") || "off";

    return player.current!.subscribe(({ canPlay }) => {
      // console.log("can play?", "->", canPlay);
      if (canPlay) {
        if (autoplay === "on") {
          if (playerState?.currentTime === 0) {
            remote.play();
          } else {
            if (playerState?.isPlaying) {
              remote.play();
            } else {
              remote.pause();
            }
          }
        } else {
          if (playerState?.isPlaying) {
            remote.play();
          } else {
            remote.pause();
          }
        }
        remote.seek(playerState?.currentTime);
      }
    });
  }, [playerState?.currentTime, playerState?.isPlaying]);

  useEffect(() => {
    const chapter = track?.skip,
      videoDuration = Math.round(duration);

    let vtt = "WEBVTT\n\n";

    let lastEndTime = 0;

    if (chapter && chapter?.length > 0) {
      chapter.forEach((item: SkipData) => {
        let startMinutes = Math.floor(item.startTime / 60);
        let startSeconds = item.startTime % 60;
        let endMinutes = Math.floor(item.endTime / 60);
        let endSeconds = item.endTime % 60;

        let start = `${startMinutes.toString().padStart(2, "0")}:${startSeconds
          .toString()
          .padStart(2, "0")}`;
        let end = `${endMinutes.toString().padStart(2, "0")}:${endSeconds
          .toString()
          .padStart(2, "0")}`;

        vtt += `${start} --> ${end}\n${item.text}\n\n`;
        if (item.endTime > lastEndTime) {
          lastEndTime = item.endTime;
        }
      });

      if (lastEndTime < videoDuration) {
        let startMinutes = Math.floor(lastEndTime / 60);
        let startSeconds = lastEndTime % 60;
        let endMinutes = Math.floor(videoDuration / 60);
        let endSeconds = videoDuration % 60;

        let start = `${startMinutes.toString().padStart(2, "0")}:${startSeconds
          .toString()
          .padStart(2, "0")}`;
        let end = `${endMinutes.toString().padStart(2, "0")}:${endSeconds
          .toString()
          .padStart(2, "0")}`;

        vtt += `${start} --> ${end}\n\n\n`;
      }

      const vttBlob = new Blob([vtt], { type: "text/vtt" });
      const vttUrl = URL.createObjectURL(vttBlob);

      setChapters(vttUrl);
    }
    return () => {
      setChapters("");
    };
  }, [track?.skip, duration]);

  useEffect(() => {
    return () => {
      if (player.current) {
        player.current.destroy();
      }
    };
  }, []);

  function onEnded() {
    if (!navigation?.next?.id) return;
    if (autoNext === "on") {
      const nextButton = document.querySelector(".next-button");

      let timeoutId: ReturnType<typeof setTimeout>;

      const stopTimeout = () => {
        clearTimeout(timeoutId);
        nextButton?.classList.remove("progress");
      };

      nextButton?.classList.remove("hidden");
      nextButton?.classList.add("progress");

      timeoutId = setTimeout(() => {
        console.log("time is up!");
        if (navigation?.next) {
          router.push(
            `/en/anime/watch/${dataMedia.id}/${track.provider}?id=${
              navigation?.next?.id
            }&num=${navigation?.next?.number}${
              track?.isDub ? `&dub=${track?.isDub}` : ""
            }`
          );
        }
      }, 7000);

      nextButton?.addEventListener("mouseover", stopTimeout);
    }
  }

  function onLoadedMetadata() {
    const seek: any = getSettings(navigation?.playing?.id);
    if (playerState?.currentTime !== 0) return;
    const seekTime = seek?.timeWatched;
    const percentage = duration !== 0 ? seekTime / Math.round(duration) : 0;
    const percentagedb =
      duration !== 0 ? userData?.timeWatched / Math.round(duration) : 0;

    if (percentage >= 0.9 || percentagedb >= 0.9) {
      remote.seek(0);
      console.log("Video started from the beginning");
    } else if (userData?.timeWatched) {
      remote.seek(userData?.timeWatched);
    } else {
      remote.seek(seekTime);
    }
  }

  let mark = 0;
  function onTimeUpdate(detail: MediaTimeUpdateEventDetail) {
    if (sessions) {
      let currentTime = detail.currentTime;
      const percentage = currentTime / duration;

      if (percentage >= 0.9) {
        // use >= instead of >
        if (mark < 1 && marked < 1) {
          mark = 1;
          setMarked(1);
          console.log("marking progress");
          markProgress(dataMedia.id, navigation.playing.number);
        }
      }
    }

    const opButton = document.querySelector(".op-button");
    const edButton = document.querySelector(".ed-button");

    const op: SkipData = track?.skip.find(
        (item: SkipData) => item.text === "Opening"
      ),
      ed = track?.skip.find((item: SkipData) => item.text === "Ending");

    if (
      op &&
      detail.currentTime > op.startTime &&
      detail.currentTime < op.endTime
    ) {
      opButton?.classList.remove("hidden");
    } else {
      opButton?.classList.add("hidden");
    }

    if (
      ed &&
      detail.currentTime > ed.startTime &&
      detail.currentTime < ed.endTime
    ) {
      edButton?.classList.remove("hidden");
    } else {
      edButton?.classList.add("hidden");
    }
  }

  function onSeeked(currentTime: number) {
    const nextButton = document.querySelector(".next-button");
    // console.log({ currentTime, duration });
    if (currentTime !== duration) {
      nextButton?.classList.add("hidden");
    }
  }

  return (
    <MediaPlayer
      key={id}
      className={`${style.player} player`}
      title={
        navigation?.playing?.title ||
        `Episode ${navigation?.playing?.number}` ||
        "Loading..."
      }
      load="idle"
      crossorigin="anonymous"
      src={{
        src: defaultQuality?.url,
        type: "application/vnd.apple.mpegurl",
      }}
      onTimeUpdate={onTimeUpdate}
      playsinline
      aspectRatio={aspectRatio}
      onEnd={onEnded}
      onSeeked={onSeeked}
      onLoadedMetadata={onLoadedMetadata}
      ref={player}
    >
      <MediaProvider>
        {track &&
          track?.subtitles &&
          track?.subtitles?.map((track: Subtitle) => (
            <Track {...track} key={track.src} />
          ))}
        {chapters?.length > 0 && (
          <Track key={chapters} src={chapters} kind="chapters" default={true} />
        )}
      </MediaProvider>
      <VideoLayout thumbnails={track?.thumbnails} navigation={navigation} />
    </MediaPlayer>
  );
}

export function calculateAspectRatio(width: number, height: number) {
  if (width === 0 && height === 0) {
    return "16/9";
  }

  const gcd = (a: number, b: number): any => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const aspectRatio = `${width / divisor}/${height / divisor}`;
  return aspectRatio;
}
