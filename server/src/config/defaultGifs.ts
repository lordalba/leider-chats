/**
 * GIFs every user gets in the shared library from the start (hosted by GIPHY).
 * Added to the database when the server starts; anything already there is left alone.
 */
const giphy = (id: string) => `https://media.giphy.com/media/${id}/200.gif`;

export const DEFAULT_GIFS: { title: string; url: string }[] = [
  { title: "Hi", url: giphy("MPxg9U887PS0B8XT4J") },
  { title: "Wave hello", url: giphy("3o6Ztp9LqQSsIwzcL6") },
  { title: "Elmo waving", url: giphy("fX5cZemSfX1cMZYuUJ") },
  { title: "Puppy waving", url: giphy("ObmvehpNJuIg0LFgKA") },
  { title: "LOL", url: giphy("3o6ozvv0zsJskzOCbu") },
  { title: "Happy dance", url: giphy("saauMNdsp2Df2") },
  { title: "Heart", url: giphy("3oz8xGRXaIHGqts3hC") },
  { title: "Love heart", url: giphy("39WXBrL07jb2zHxIgj") },
  { title: "Penguin love", url: giphy("l2QDYGQQKKNGq6mhq") },
  { title: "Love you", url: giphy("XqRMJsXHuQMBHvw7QA") },
  { title: "Mind blown", url: giphy("26ufdipQqU2lhNA4g") },
  { title: "Wow", url: giphy("l0HlEOf5L0m2YEbW8") },
  { title: "Sad", url: giphy("3o85xtxhptQYxlTt0k") },
];
