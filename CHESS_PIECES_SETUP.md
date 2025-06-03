# Chess Piece Images Setup

## Where to Place Your Chess Pieces

Place your chess piece image files in the following directory:

```
/Users/hamzawahab/Library/Developer/nyre/public/pieces/
```

## Required Image Files

Your chess piece images should be named exactly as follows:

### White Pieces:

- `white-king.png`
- `white-queen.png`
- `white-rook.png`
- `white-bishop.png`
- `white-knight.png`
- `white-pawn.png`

### Black Pieces:

- `black-king.png`
- `black-queen.png`
- `black-rook.png`
- `black-bishop.png`
- `black-knight.png`
- `black-pawn.png`

## Image Requirements

- **Format**: PNG (recommended) or JPG
- **Size**: Ideally 80x80 pixels or larger
- **Background**: Transparent (for PNG) or white background
- **Quality**: High resolution for crisp display

## Directory Structure

After placing your images, the structure should look like:

```
public/
└── pieces/
    ├── white-king.png
    ├── white-queen.png
    ├── white-rook.png
    ├── white-bishop.png
    ├── white-knight.png
    ├── white-pawn.png
    ├── black-king.png
    ├── black-queen.png
    ├── black-rook.png
    ├── black-bishop.png
    ├── black-knight.png
    └── black-pawn.png
```

## Fallback System

If any image fails to load, the system will automatically fall back to Unicode chess symbols:

- ♔♕♖♗♘♙ (White pieces)
- ♚♛♜♝♞♟ (Black pieces)

## Board Size Update

The chess board has been updated to:

- **Board size**: 800x800 pixels
- **Square size**: 100x100 pixels each
- **Piece image size**: 80x80 pixels (with 10px padding)

## Testing

After placing your images:

1. Restart the development server: `npm run dev`
2. Visit http://localhost:3000/board
3. The chess pieces should display your custom images
4. If images don't load, check the browser console for any 404 errors

## Customization

If you want to use different file names or formats, update the `pieceImages` object in:
`src/components/ChessBoard.tsx` around line 30-42.
