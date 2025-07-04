document.addEventListener('DOMContentLoaded', () => {
    const boardContainer = document.getElementById('board-container');
    const statusMessage = document.getElementById('status-message');
    const p1Sidebar = document.getElementById('player-1-sidebar');
    const p2Sidebar = document.getElementById('player-2-sidebar');

    const UNICODE_PIECES = {
        'king': '♚', 'queen': '♛', 'rook': '♜', 'bishop': '♝', 'knight': '♞', 'pawn': '♟︎'
    };

    const PLAYERS = [{ id: 1, name: 'Red' }, { id: 2, name: 'Blue' }];

    const PIECE_CONFIG = {
        'queen': 1, 'rook': 2, 'bishop': 2, 'knight': 2, 'pawn': 2, 'king': 1
    };

    let gameState = {};

    function getInitialPieceSet() {
        const set = [];
        for (const [type, count] of Object.entries(PIECE_CONFIG)) {
            for (let i = 0; i < count; i++) {
                set.push(type);
            }
        }
        return set;
    }

    function init() {
        const initialPieceSet = getInitialPieceSet();
        gameState = {
            phase: 'deployment', // deployment, gameplay
            players: PLAYERS,
            currentPlayerIndex: 0,
            board: new Map(), // "x,y" -> {type, playerIndex}
            selectedSidebarPiece: null,
            selectedBoardPiece: null,
            deployment: {
                p1_pieces: [...initialPieceSet],
                p2_pieces: [...initialPieceSet],
            },
        };
        addEventListeners();
        render();
    }

    function addEventListeners() {
        boardContainer.addEventListener('click', handleBoardClick);
        p1Sidebar.addEventListener('click', (e) => handleSidebarClick(e, 0));
        p2Sidebar.addEventListener('click', (e) => handleSidebarClick(e, 1));
    }

    function handleBoardClick(e) {
        const square = e.target.closest('.square');
        if (!square) return;

        const { x, y } = square.dataset;
        const gx = parseInt(x, 10);
        const gy = parseInt(y, 10);

        if (gameState.phase === 'deployment') {
            handleDeploymentPlacement(gx, gy);
        } else if (gameState.phase === 'gameplay') {
            handleGameplayMove(gx, gy);
        }
    }

    function handleSidebarClick(e, playerIndex) {
        if (gameState.phase !== 'deployment' || gameState.currentPlayerIndex !== playerIndex) {
            return;
        }
        const pieceDiv = e.target.closest('.piece');
        if (pieceDiv && pieceDiv.dataset.type) {
            const pieceType = pieceDiv.dataset.type;
            const piecesToPlace = playerIndex === 0 ? gameState.deployment.p1_pieces : gameState.deployment.p2_pieces;

            // Rule: King can only be selected if it's the last piece.
            if (pieceType === 'king' && piecesToPlace.length > 1) {
                statusMessage.textContent = 'The King must be placed last.';
                return;
            }

            // A piece is selectable if it's in the list of pieces to place.
            if (piecesToPlace.includes(pieceType)) {
                 gameState.selectedSidebarPiece = { type: pieceType, playerIndex };
                 render();
            }
        }
    }
    
    function handleDeploymentPlacement(gx, gy) {
        if (!gameState.selectedSidebarPiece || gameState.board.has(`${gx},${gy}`)) {
            return;
        }

        const { type, playerIndex } = gameState.selectedSidebarPiece;
        const key = `${gx},${gy}`;
        
        if (gameState.board.size > 0 && !checkContinuity(gameState.board, null, { x: gx, y: gy })) {
            statusMessage.textContent = 'Placement must be adjacent to existing pieces.';
            return;
        }

        gameState.board.set(key, { type, playerIndex });
        
        const piecesToPlace = playerIndex === 0 ? gameState.deployment.p1_pieces : gameState.deployment.p2_pieces;
        // Remove the specific piece that was placed from the player's list.
        const placedPieceIndex = piecesToPlace.indexOf(type);
        if (placedPieceIndex > -1) {
            piecesToPlace.splice(placedPieceIndex, 1);
        }

        gameState.selectedSidebarPiece = null;
        switchPlayer();

        if (gameState.deployment.p1_pieces.length === 0 && gameState.deployment.p2_pieces.length === 0) {
            gameState.phase = 'gameplay';
        }
        render();
    }

    function handleGameplayMove(gx, gy) {
        const key = `${gx},${gy}`;
        const clickedPiece = gameState.board.get(key);

        if (gameState.selectedBoardPiece) {
            const startPos = gameState.selectedBoardPiece.pos;
            const endPos = { x: gx, y: gy };
            const validMoves = getValidMoves(gameState.selectedBoardPiece);
            
            const isMoveValid = validMoves.some(move => move.x === endPos.x && move.y === endPos.y);

            if (isMoveValid) {
                if (!checkContinuity(gameState.board, startPos, endPos)) {
                    statusMessage.textContent = "Invalid Move: Breaks board continuity.";
                    gameState.selectedBoardPiece = null;
                    render();
                    return;
                }

                const pieceToMove = gameState.board.get(`${startPos.x},${startPos.y}`);
                gameState.board.delete(`${startPos.x},${startPos.y}`);
                gameState.board.set(`${endPos.x},${endPos.y}`, pieceToMove);
                
                const kings = [...gameState.board.values()].filter(p => p.type === 'king');
                if (kings.length < 2) {
                    gameState.phase = 'end';
                    const winner = kings.length === 1 ? PLAYERS[kings[0].playerIndex].name : "Nobody";
                    statusMessage.textContent = `${winner} Wins! Happy Birthday!`;
                    render();
                    return;
                }

                switchPlayer();
            }
            gameState.selectedBoardPiece = null;
        } else if (clickedPiece && clickedPiece.playerIndex === gameState.currentPlayerIndex) {
            gameState.selectedBoardPiece = { ...clickedPiece, pos: { x: gx, y: gy } };
        }
        render();
    }
    
    function switchPlayer() {
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    }
    
    function getValidMoves(piece) {
        const { type, pos, playerIndex } = piece;
        const moves = [];
        const board = gameState.board;

        const movePatterns = {
            pawn: () => {
                const cardinal = [{x:0,y:1}, {x:0,y:-1}, {x:1,y:0}, {x:-1,y:0}];
                const diagonal = [{x:1,y:1}, {x:1,y:-1}, {x:-1,y:1}, {x:-1,y:-1}];
                
                cardinal.forEach(d => {
                    const newPos = {x: pos.x + d.x, y: pos.y + d.y};
                    if (!board.has(`${newPos.x},${newPos.y}`)) moves.push(newPos);
                });
                diagonal.forEach(d => {
                    const newPos = {x: pos.x + d.x, y: pos.y + d.y};
                    const target = board.get(`${newPos.x},${newPos.y}`);
                    if (target && target.playerIndex !== playerIndex) moves.push(newPos);
                });
            },
            rook: () => getSlidingMoves([{x:0,y:1}, {x:0,y:-1}, {x:1,y:0}, {x:-1,y:0}]),
            bishop: () => getSlidingMoves([{x:1,y:1}, {x:1,y:-1}, {x:-1,y:1}, {x:-1,y:-1}]),
            queen: () => getSlidingMoves([{x:0,y:1}, {x:0,y:-1}, {x:1,y:0}, {x:-1,y:0}, {x:1,y:1}, {x:1,y:-1}, {x:-1,y:1}, {x:-1,y:-1}]),
            knight: () => {
                const knightMoves = [{x:1,y:2},{x:1,y:-2},{x:-1,y:2},{x:-1,y:-2},{x:2,y:1},{x:2,y:-1},{x:-2,y:1},{x:-2,y:-1}];
                knightMoves.forEach(d => {
                    const newPos = {x: pos.x + d.x, y: pos.y + d.y};
                    const target = board.get(`${newPos.x},${newPos.y}`);
                    if (!target || target.playerIndex !== playerIndex) moves.push(newPos);
                });
            },
            king: () => {
                const kingMoves = [{x:0,y:1}, {x:0,y:-1}, {x:1,y:0}, {x:-1,y:0}, {x:1,y:1}, {x:1,y:-1}, {x:-1,y:1}, {x:-1,y:-1}];
                kingMoves.forEach(d => {
                    const newPos = {x: pos.x + d.x, y: pos.y + d.y};
                    const target = board.get(`${newPos.x},${newPos.y}`);
                    if (!target || target.playerIndex !== playerIndex) moves.push(newPos);
                });
            }
        };

        /**
         * Calculates valid moves for sliding pieces (Rook, Bishop, Queen).
         * This logic allows pieces to "pass through" friendly pieces.
         */
        function getSlidingMoves(directions) {
            directions.forEach(dir => {
                let currentPos = { ...pos };
                for (let i = 0; i < 100; i++) { // Safety break for potentially infinite boards
                    currentPos = { x: currentPos.x + dir.x, y: currentPos.y + dir.y };
                    const key = `${currentPos.x},${currentPos.y}`;
                    const target = board.get(key);

                    if (target) { // If a square has a piece on it
                        if (target.playerIndex === playerIndex) {
                            // Friendly piece: cannot land here, but the line of sight continues.
                            // The original python code implements this by explicitly continuing the loop.
                            continue;
                        } else {
                            // Enemy piece: can land here (capture), but the line of sight is blocked.
                            moves.push(currentPos);
                            break;
                        }
                    } else {
                        // Empty square: can land here, and the line of sight continues.
                        moves.push(currentPos);
                    }
                }
            });
        }

        movePatterns[type]();
        return moves;
    }

    function checkContinuity(board, startPos, endPos) {
        const tempBoard = new Map(board);
        if (startPos) {
            const piece = tempBoard.get(`${startPos.x},${startPos.y}`);
            tempBoard.delete(`${startPos.x},${startPos.y}`);
            tempBoard.set(`${endPos.x},${endPos.y}`, piece);
        } else {
            tempBoard.set(`${endPos.x},${endPos.y}`, {type: 'dummy', playerIndex: -1});
        }

        if (tempBoard.size <= 1) return true;

        const positions = Array.from(tempBoard.keys());
        const visited = new Set();
        const queue = [positions[0]];
        visited.add(positions[0]);

        while (queue.length > 0) {
            const [xStr, yStr] = queue.shift().split(',');
            const x = parseInt(xStr, 10);
            const y = parseInt(yStr, 10);

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const neighborKey = `${x + dx},${y + dy}`;
                    if (tempBoard.has(neighborKey) && !visited.has(neighborKey)) {
                        visited.add(neighborKey);
                        queue.push(neighborKey);
                    }
                }
            }
        }
        return visited.size === tempBoard.size;
    }

    function render() {
        renderBoard();
        renderSidebars();
        updateStatusMessage();
    }

    function renderBoard() {
        boardContainer.innerHTML = '';
        if (gameState.board.size === 0) {
             boardContainer.style.gridTemplateColumns = 'repeat(5, 1fr)';
             for (let i = 0; i < 25; i++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.dataset.x = Math.floor(i % 5) - 2;
                square.dataset.y = Math.floor(i / 5) - 2;
                boardContainer.appendChild(square);
             }
             return;
        }

        const positions = [...gameState.board.keys()].map(k => k.split(',').map(Number));
        const minX = Math.min(...positions.map(p => p[0]));
        const maxX = Math.max(...positions.map(p => p[0]));
        const minY = Math.min(...positions.map(p => p[1]));
        const maxY = Math.max(...positions.map(p => p[1]));

        const buffer = 2;
        const gridCols = maxX - minX + 1 + buffer * 2;
        
        boardContainer.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;

        let validMoves = [];
        if (gameState.phase === 'gameplay' && gameState.selectedBoardPiece) {
            validMoves = getValidMoves(gameState.selectedBoardPiece);
        }

        for (let r = minY - buffer; r <= maxY + buffer; r++) {
            for (let c = minX - buffer; c <= maxX + buffer; c++) {
                const key = `${c},${r}`;
                const piece = gameState.board.get(key);
                const square = document.createElement('div');
                square.classList.add('square');
                square.dataset.x = c;
                square.dataset.y = r;

                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.classList.add('piece', `player${piece.playerIndex + 1}`);
                    pieceEl.textContent = UNICODE_PIECES[piece.type];
                    square.appendChild(pieceEl);
                    square.classList.add('occupied', `player${piece.playerIndex + 1}-square`);
                } else {
                    square.classList.remove('occupied');
                    square.classList.remove('player1-square', 'player2-square'); // Add more classes if you have more players
                }

                if (gameState.selectedBoardPiece && c === gameState.selectedBoardPiece.pos.x && r === gameState.selectedBoardPiece.pos.y) {
                    square.classList.add('selected-piece-highlight');
                }

                if (validMoves.some(move => move.x === c && move.y === r)) {
                    square.classList.add('valid-move-highlight');
                }

                boardContainer.appendChild(square);
            }
        }
    }

    function renderSidebars() {
        p1Sidebar.innerHTML = '';
        p2Sidebar.innerHTML = '';

        if (gameState.phase !== 'deployment') {
            p1Sidebar.style.display = 'none';
            p2Sidebar.style.display = 'none';
            return;
        }
        
        p1Sidebar.style.display = 'flex';
        p2Sidebar.style.display = 'flex';

        const p1Counts = countRemainingPieces(gameState.deployment.p1_pieces);
        const p2Counts = countRemainingPieces(gameState.deployment.p2_pieces);
        
        for (const type of Object.keys(PIECE_CONFIG)) {
            p1Sidebar.appendChild(createSidebarTile(type, p1Counts[type] || 0, 0));
            p2Sidebar.appendChild(createSidebarTile(type, p2Counts[type] || 0, 1));
        }
    }
    
    function createSidebarTile(type, count, playerIndex) {
        const tile = document.createElement('div');
        tile.classList.add('piece-info');
        const pieceDiv = document.createElement('div');
        pieceDiv.classList.add('piece', `player${playerIndex + 1}`);
        pieceDiv.textContent = UNICODE_PIECES[type];
        
        const piecesToPlace = playerIndex === 0 ? gameState.deployment.p1_pieces : gameState.deployment.p2_pieces;
        const isKingLastPiece = piecesToPlace.length === 1 && piecesToPlace[0] === 'king';

        if (count > 0 && gameState.currentPlayerIndex === playerIndex) {
            if (type === 'king' && !isKingLastPiece) {
                pieceDiv.style.opacity = '0.5';
                pieceDiv.style.cursor = 'not-allowed';
            } else {
                pieceDiv.style.cursor = 'pointer';
                pieceDiv.dataset.type = type;
                if (gameState.selectedSidebarPiece && gameState.selectedSidebarPiece.type === type && gameState.selectedSidebarPiece.playerIndex === playerIndex) {
                    pieceDiv.classList.add('selected');
                }
            }
        } else {
            pieceDiv.style.opacity = count > 0 ? '0.5' : '0.2';
        }
        
        tile.appendChild(pieceDiv);
        const countSpan = document.createElement('span');
        countSpan.textContent = `x${count}`;
        tile.appendChild(countSpan);
        return tile;
    }

    function countRemainingPieces(pieceList) {
        return pieceList.reduce((acc, type) => {
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
    }

    function updateStatusMessage() {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        if (gameState.phase === 'deployment') {
            const piecesToPlace = gameState.currentPlayerIndex === 0 ? gameState.deployment.p1_pieces : gameState.deployment.p2_pieces;
            if(piecesToPlace.length > 0){
                statusMessage.textContent = `${currentPlayer.name}, place a piece.`;
            } else {
                 statusMessage.textContent = `Waiting for ${PLAYERS[1].name}...`;
            }
        } else if (gameState.phase === 'gameplay') {
            statusMessage.textContent = `${currentPlayer.name}'s Turn`;
        }
    }

    init();
});