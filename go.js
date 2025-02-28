<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>JavaScript Go</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #faf0d7;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    h1 {
      margin: 1rem 0 0.5rem;
    }
    #gameContainer {
      position: relative;
      /* canvas size will be defined by our board constants */
    }
    canvas {
      display: block;
      background: #dcb67c; /* wooden board color */
    }
    .overlayScreen {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: none;
      background: rgba(255,255,255,0.95);
      align-items: center;
      justify-content: center;
      flex-direction: column;
      text-align: center;
      z-index: 5;
      padding: 20px;
    }
    button {
      font-size: 18px;
      margin: 10px;
      padding: 10px 20px;
      cursor: pointer;
    }
    #bottomBar {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 40px;
      background: rgba(255,255,255,0.9);
      display: flex;
      align-items: center;
      padding-left: 10px;
      box-sizing: border-box;
      z-index: 2;
      border-top: 1px solid #ccc;
    }
  </style>
</head>
<body>
  <h1>JavaScript Go</h1>
  <div id="gameContainer">
    <!-- MENU SCREEN -->
    <div id="menuScreen" class="overlayScreen" style="display:flex;">
      <h2>JavaScript Go</h2>
      <button id="newGameBtn">New Game</button>
      <button id="instructionsBtn">Instructions</button>
    </div>

    <!-- INSTRUCTIONS SCREEN -->
    <div id="instructionsScreen" class="overlayScreen">
      <div style="max-width:600px; text-align:left;">
        <p><strong>Objective</strong></p>
        <p>The goal of the game is to control more territory on the board than your opponent by surrounding empty points with your stones.</p>
        <p><strong>Setup</strong></p>
        <ul>
          <li><strong>Board:</strong> A 19×19 grid.</li>
          <li><strong>Players:</strong> Two players – Black (plays first) and White.</li>
          <li><strong>Stones:</strong> Players take turns placing stones on the intersections (not inside squares).</li>
        </ul>
        <p><strong>Game Rules</strong></p>
        <ul>
          <li>Players take turns placing one stone per turn on an empty intersection.</li>
          <li>Once placed, stones do not move.</li>
          <li>A group of connected stones (horizontally or vertically adjacent) must have at least one empty adjacent point ("liberty").</li>
          <li>If a group loses all liberties (is completely surrounded by the opponent’s stones), it is captured and removed from the board.</li>
          <li><strong>Ko Rule:</strong> You cannot make a move that recreates the previous board state, preventing an infinite loop of captures.</li>
          <li><strong>Suicide Rule:</strong> You cannot place a stone if that move would result in your own stone or group having no liberties—unless it captures opposing stones.</li>
          <li><strong>Passing Turns:</strong> A player may pass if no beneficial move is available. If both players pass consecutively, the game ends.</li>
        </ul>
        <p><strong>Winning the Game</strong></p>
        <ul>
          <li><strong>Territory Points:</strong> Each empty intersection completely enclosed by a player’s stones counts as a point.</li>
          <li><strong>Captured Stones:</strong> Each stone captured from the opponent adds one point.</li>
          <li><strong>Komi (White’s Bonus):</strong> A bonus (commonly 7 points) is given to White to offset Black’s first-move advantage.</li>
        </ul>
        <p>The player with the highest total (territory + captured stones + komi) wins.</p>
        <br/>
        <p>Press [M] to return to the Main Menu.</p>
      </div>
    </div>

    <!-- GAME OVER SCREEN -->
    <div id="gameOverScreen" class="overlayScreen">
      <h2 id="gameOverText"></h2>
      <button id="gameOverNewGameBtn">New Game</button>
      <p>Press [M] to return to the Main Menu.</p>
    </div>

    <!-- Canvas -->
    <canvas id="goCanvas"></canvas>
    
    <!-- Bottom Bar with Pass Button and current turn -->
    <div id="bottomBar">
      <span id="turnDisplay">Turn: Black</span>
      <button id="passBtn" style="margin-left:auto; margin-right:10px;">Pass</button>
    </div>
  </div>

  <script>
    /*******************************
     * Global Variables & Constants
     *******************************/
    const BOARD_SIZE = 19;
    const CELL_SIZE = 30; // spacing between intersections
    const MARGIN = CELL_SIZE; // margin around the grid
    const BOARD_PIXEL_SIZE = MARGIN * 2 + (BOARD_SIZE - 1) * CELL_SIZE;
    const KOMI = 7; // bonus for White

    let canvas = document.getElementById("goCanvas");
    canvas.width = BOARD_PIXEL_SIZE;
    canvas.height = BOARD_PIXEL_SIZE;
    let ctx = canvas.getContext("2d");

    // Game state variables
    let board = []; // 2D array representing the board (null, 'b', or 'w')
    let currentPlayer = 'b'; // 'b' (Black) or 'w' (White)
    let prevBoardState = ""; // used for ko rule (stores string of previous board)
    let passCount = 0;
    let blackCaptured = 0, whiteCaptured = 0;
    let gameState = "menu"; // "menu", "playing", "instructions", "game_over"

    // UI Elements
    const menuScreen = document.getElementById("menuScreen");
    const instructionsScreen = document.getElementById("instructionsScreen");
    const gameOverScreen = document.getElementById("gameOverScreen");
    const gameOverText = document.getElementById("gameOverText");
    const turnDisplay = document.getElementById("turnDisplay");

    /*******************************
     * Board & Utility Functions
     *******************************/
    function newBoard() {
      board = [];
      for (let r = 0; r < BOARD_SIZE; r++) {
        let row = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
          row.push(null);
        }
        board.push(row);
      }
    }

    // Return a deep copy of the board (2D array)
    function cloneBoard(bd) {
      return bd.map(row => row.slice());
    }

    // Convert board array to a string for ko checking.
    function boardToString(bd) {
      return bd.map(row => row.map(cell => cell ? cell : ".").join("")).join("\n");
    }

    // Get pixel coordinates (x,y) of a board intersection.
    function getIntersectionCoordinates(row, col) {
      let x = MARGIN + col * CELL_SIZE;
      let y = MARGIN + row * CELL_SIZE;
      return { x, y };
    }

    // Get valid neighbor coordinates (up, down, left, right).
    function getNeighbors(row, col) {
      let neighbors = [];
      if (row > 0) neighbors.push({ r: row - 1, c: col });
      if (row < BOARD_SIZE - 1) neighbors.push({ r: row + 1, c: col });
      if (col > 0) neighbors.push({ r: row, c: col - 1 });
      if (col < BOARD_SIZE - 1) neighbors.push({ r: row, c: col + 1 });
      return neighbors;
    }

    // Get the group (connected stones of the same color) and its liberties.
    function getGroup(bd, row, col, visited = {}) {
      let color = bd[row][col];
      let group = [];
      let liberties = new Set();
      let key = (r, c) => r + "_" + c;
      function dfs(r, c) {
        let id = key(r, c);
        if (visited[id]) return;
        visited[id] = true;
        group.push({ r, c });
        let neighbors = getNeighbors(r, c);
        for (let n of neighbors) {
          if (bd[n.r][n.c] === null) {
            liberties.add(key(n.r, n.c));
          } else if (bd[n.r][n.c] === color) {
            dfs(n.r, n.c);
          }
        }
      }
      dfs(row, col);
      return { group, liberties };
    }

    /*******************************
     * Move Simulation & Rule Checks
     *******************************/
    // Try to simulate a move at (row, col) for color.
    // Returns an object { legal: true/false, newBoard, captured }.
    function simulateMove(bd, row, col, color) {
      if (bd[row][col] !== null) return { legal: false };
      let newBd = cloneBoard(bd);
      newBd[row][col] = color;
      let captured = 0;
      let opponent = (color === 'b') ? 'w' : 'b';

      // Check all neighbors for opponent groups that have no liberties.
      let neighbors = getNeighbors(row, col);
      for (let n of neighbors) {
        if (newBd[n.r][n.c] === opponent) {
          let { group, liberties } = getGroup(newBd, n.r, n.c);
          if (liberties.size === 0) {
            // Capture the group.
            group.forEach(stone => { newBd[stone.r][stone.c] = null; });
            captured += group.length;
          }
        }
      }
      // Now check the group of the newly placed stone.
      let { group, liberties } = getGroup(newBd, row, col);
      // If no liberties and no opponent stones captured, it's a suicide move.
      if (liberties.size === 0 && captured === 0) return { legal: false };

      // Check the Ko rule: the new board state must not equal the previous board state.
      let newState = boardToString(newBd);
      if (newState === prevBoardState) return { legal: false };

      return { legal: true, newBoard: newBd, captured };
    }

    // Attempt to place a stone at the given board coordinates.
    function attemptMove(row, col) {
      let result = simulateMove(board, row, col, currentPlayer);
      if (!result.legal) {
        console.warn("Illegal move at", row, col);
        return;
      }
      // Save current board state to check ko next turn.
      prevBoardState = boardToString(board);
      board = result.newBoard;
      // Update capture counts.
      if (currentPlayer === 'b') {
        blackCaptured += result.captured;
      } else {
        whiteCaptured += result.captured;
      }
      passCount = 0; // reset consecutive passes when a stone is played.
      swapPlayer();
    }

    // Swap the turn to the other player.
    function swapPlayer() {
      currentPlayer = (currentPlayer === 'b') ? 'w' : 'b';
      turnDisplay.textContent = "Turn: " + (currentPlayer === 'b' ? "Black" : "White");
    }

    /*******************************
     * Drawing Functions
     *******************************/
    function drawBoard() {
      // Clear canvas.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw grid lines.
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      for (let i = 0; i < BOARD_SIZE; i++) {
        // Vertical lines.
        ctx.beginPath();
        ctx.moveTo(MARGIN + i * CELL_SIZE, MARGIN);
        ctx.lineTo(MARGIN + i * CELL_SIZE, MARGIN + (BOARD_SIZE - 1) * CELL_SIZE);
        ctx.stroke();
        // Horizontal lines.
        ctx.beginPath();
        ctx.moveTo(MARGIN, MARGIN + i * CELL_SIZE);
        ctx.lineTo(MARGIN + (BOARD_SIZE - 1) * CELL_SIZE, MARGIN + i * CELL_SIZE);
        ctx.stroke();
      }
      // Optionally, draw star points (for a 19x19 board these are at 4-4, 4-10, 4-16, etc.).
      const starPoints = [3, 9, 15];
      ctx.fillStyle = "#000";
      for (let i of starPoints) {
        for (let j of starPoints) {
          let { x, y } = getIntersectionCoordinates(i, j);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      drawStones();
    }

    // Draw stones on the board.
    function drawStones() {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c]) {
            let { x, y } = getIntersectionCoordinates(r, c);
            ctx.beginPath();
            ctx.arc(x, y, CELL_SIZE * 0.45, 0, 2 * Math.PI);
            ctx.fillStyle = board[r][c] === 'b' ? "#000" : "#fff";
            ctx.fill();
            ctx.strokeStyle = "#000";
            ctx.stroke();
          }
        }
      }
    }

    /*******************************
     * Scoring at Game End
     *******************************/
    // Flood-fill algorithm to compute territory for empty regions.
    function calculateTerritory() {
      let visited = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(false));
      let blackTerritory = 0, whiteTerritory = 0;
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] === null && !visited[r][c]) {
            let queue = [{r, c}];
            let region = [];
            let bordering = new Set();
            while (queue.length > 0) {
              let cell = queue.pop();
              if (visited[cell.r][cell.c]) continue;
              visited[cell.r][cell.c] = true;
              region.push(cell);
              let neighbors = getNeighbors(cell.r, cell.c);
              for (let n of neighbors) {
                if (board[n.r][n.c] === null && !visited[n.r][n.c]) {
                  queue.push(n);
                } else if (board[n.r][n.c] !== null) {
                  bordering.add(board[n.r][n.c]);
                }
              }
            }
            if (bordering.size === 1) {
              let owner = bordering.values().next().value;
              if (owner === 'b') blackTerritory += region.length;
              else whiteTerritory += region.length;
            }
          }
        }
      }
      return { blackTerritory, whiteTerritory };
    }

    function endGame() {
      // Compute territory.
      let { blackTerritory, whiteTerritory } = calculateTerritory();
      let blackScore = blackTerritory + blackCaptured;
      let whiteScore = whiteTerritory + whiteCaptured + KOMI;
      let resultText = `Game Over!<br>
                        Black: Territory ${blackTerritory} + Captured ${blackCaptured} = ${blackScore}<br>
                        White: Territory ${whiteTerritory} + Captured ${whiteCaptured} + Komi ${KOMI} = ${whiteScore}<br>
                        Winner: ${blackScore === whiteScore ? "Tie" : (blackScore > whiteScore ? "Black" : "White")}`;
      gameOverText.innerHTML = resultText;
      gameState = "game_over";
    }

    /*******************************
     * Input Handling
     *******************************/
    // Convert mouse click to board coordinates (if close enough to an intersection).
    canvas.addEventListener("mousedown", (e) => {
      if (gameState !== "playing") return;
      let rect = canvas.getBoundingClientRect();
      let mx = e.clientX - rect.left;
      let my = e.clientY - rect.top;
      // Find the closest intersection.
      let col = Math.round((mx - MARGIN) / CELL_SIZE);
      let row = Math.round((my - MARGIN) / CELL_SIZE);
      // Only register if click is within a tolerance.
      let { x, y } = getIntersectionCoordinates(row, col);
      let dist = Math.hypot(mx - x, my - y);
      if (dist < CELL_SIZE * 0.5) {
        attemptMove(row, col);
      }
    });

    // Pass button handler.
    document.getElementById("passBtn").addEventListener("click", () => {
      if (gameState !== "playing") return;
      passCount++;
      // If two passes in a row, game over.
      if (passCount >= 2) {
        endGame();
      } else {
        swapPlayer();
      }
    });

    /*******************************
     * Overlay & Menu Management
     *******************************/
    function hideAllScreens() {
      menuScreen.style.display = "none";
      instructionsScreen.style.display = "none";
      gameOverScreen.style.display = "none";
    }

    function showMenu() {
      hideAllScreens();
      gameState = "menu";
      menuScreen.style.display = "flex";
    }

    function showInstructions() {
      hideAllScreens();
      gameState = "instructions";
      instructionsScreen.style.display = "flex";
    }

    function startPlaying() {
      hideAllScreens();
      newGame();
      currentPlayer = 'b';
      turnDisplay.textContent = "Turn: Black";
      passCount = 0;
      blackCaptured = 0;
      whiteCaptured = 0;
      prevBoardState = boardToString(board);
      gameState = "playing";
    }

    function showGameOver() {
      hideAllScreens();
      gameOverScreen.style.display = "flex";
    }

    // Button event handlers.
    document.getElementById("newGameBtn").onclick = startPlaying;
    document.getElementById("instructionsBtn").onclick = showInstructions;
    document.getElementById("gameOverNewGameBtn").onclick = startPlaying;

    // Unified keyboard shortcuts.
    document.addEventListener("keydown", (e) => {
      let key = e.key.toLowerCase();
      if (key === "m") {
        // Return to menu from instructions or game over.
        showMenu();
      }
      if (gameState === "playing" && key === "p") {
        // "p" key to pass.
        document.getElementById("passBtn").click();
      }
    });

    /*******************************
     * Main Loop
     *******************************/
    function mainLoop() {
      if (gameState === "playing") {
        drawBoard();
      }
      requestAnimationFrame(mainLoop);
    }

    // Start the animation loop.
    requestAnimationFrame(mainLoop);

    // Initialize to menu.
    showMenu();
  </script>
</body>
</html>
