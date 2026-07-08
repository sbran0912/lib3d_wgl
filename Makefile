.PHONY: all dev build clean

all: build

dev:
	bun index.html

build:
	bun build ./index.html --outdir=dist

clean:
	rm -rf dist
