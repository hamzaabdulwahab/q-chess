# Chess Game

A modern chess game built with Next.js, TypeScript, and Tailwind CSS, now powered by Bun for faster package management and development.

## Prerequisites

- [Bun](https://bun.sh/) - Fast all-in-one JavaScript runtime
- Node.js 18+ (for Next.js compatibility)

## Getting Started

### Installation

```bash
# Install dependencies with Bun
bun install
```

### Development

```bash
# Start the development server
bun run dev
```

The application will be available at `http://localhost:3000`.

### Building

```bash
# Build for production
bun run build

# Start production server
bun run start
```

### Linting

```bash
# Run ESLint
bun run lint
```

## Package Management

This project uses Bun as the package manager. Here are some useful commands:

```bash
# Add a new dependency
bun add package-name

# Add a development dependency
bun add -d package-name

# Remove a dependency
bun remove package-name

# Update dependencies
bun update
```

## Features

- ♟️ Full chess piece movement with legal move validation
- 🎯 Interactive chess board with drag-and-drop or click-to-move
- 🏰 Support for special moves (castling, en passant, pawn promotion)
- 🔊 Sound effects for different move types
- 📱 Responsive design for mobile and desktop
- 🎨 Beautiful UI with Tailwind CSS
- ⚡ Fast development with Bun and Next.js Turbopack

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Chess Logic**: chess.js
- **Package Manager**: Bun
- **Bundler**: Turbopack (Next.js)

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── page.tsx        # Home page
│   └── board/          # Chess board page
├── components/         # React components
│   ├── ChessBoard.tsx  # Main chess board component
│   ├── GameStatusPanel.tsx
│   └── SoundControl.tsx
├── lib/                # Utility libraries
│   ├── chess-client.ts # Chess game logic
│   └── sound-manager.ts # Sound effects
└── types/              # TypeScript type definitions
    └── chess.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is private and proprietary.
