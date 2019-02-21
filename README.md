# Moosic Yeoman Generator

Interactive CLI tool to upload file(s) to S3 and DynamoDB

## Installation

1. Install repo
```
git clone https://github.com/bennetthanna/generator-moosic.git
```

2. Install packages
```
npm install
```

3. Link package
```
npm link
```

4. Follow the prompts and upload that moosic!
```
yo moosic
```

## Assumptions

> When you assume, you make an ass out of u and me

- This tool assumes you have permission to assume the role `moosic-access`
- This tool assumes you have correctly set up your AWS credentials
    - Checkout how to do so [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)

## Notes

- Files are uploaded to S3 with the following key format `genre/artist/album/song`
- You will _always_ be prompted for the genre
- All resources must have an associated genre, artist, album, and song title
	- If they are not provided through the file path, they will be prompted for
- You will be prompted to change the name of the resource you are uploading
	- When uploading an artist, it will prompt you to change the name of the artist
	- When uploading an album, it will prompt you to change the name of the album
	- When uploading an song, it will prompt you to change the name of the song
- When you upload a directory (an artist or an album) you can change the root name but everything else will stay the same

```
Example
-------

- artist
	- album_1
		- song_1
		- song_2
	- album_2
		- song_1
		- song_2

Upload files:
prompted_genre/prompted_artist/album_1/song_1
prompted_genre/prompted_artist/album_1/song_2
prompted_genre/prompted_artist/album_2/song_1
prompted_genre/prompted_artist/album_2/song_2

```
