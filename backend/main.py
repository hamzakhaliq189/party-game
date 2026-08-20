from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import random
import string
import json
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DatabaseHandler:
    def __init__(self):
        self._mock_db = {
          # Truth or Dare Decks
          "family": {
            "truth": ["If you could have any superpower, what would it be?", "What's the silliest thing you've ever done?", "Who is your favorite superhero and why?", "What is your worst habit?", "If you had three wishes, what would they be?"],
            "dare": ["Do your best dance move for 10 seconds.", "Try to juggle 3 invisible items.", "Speak like a robot for the next round.", "Try not to blink for 30 seconds.", "Walk around the room balancing a book on your head."]
          },
          "icebreaker": {
            "truth": ["What's your most controversial food opinion?", "What was your worst haircut?", "If you had to sing karaoke right now, what song would you pick?", "What is the weirdest rumor you've heard about yourself?"],
            "dare": ["Let the group pose you for a photo.", "Do an impression of someone in the room.", "Show the last photo in your camera roll.", "Talk in a British accent until your next turn."]
          },
          "lums": {
            "truth": ["Have you ever lied about your Phase 2 enrollment priority?", "What's the most embarrassing thing you've done at the Khoka?", "Which instructor are you most terrified of?"],
            "dare": ["Send a vague 'We need to talk' text to your project partner.", "Act like you're giving a presentation on why PDC food is 5-star.", "Do a 30-second dramatic reading of the LUMS Code of Conduct."]
          },
          
          # Dumb Charades Decks
          "charades_movies": ["Inception", "The Godfather", "Titanic", "The Matrix", "The Dark Knight", "Avatar", "Jurassic Park", "Forrest Gump", "The Lion King", "Harry Potter", "Interstellar", "Pulp Fiction", "The Avengers", "Gladiator", "Sholay", "3 Idiots", "Dangal", "The Legend of Maula Jatt", "Spider-Man", "Fight Club"],
          "charades_celebrities": ["Tom Cruise", "Leonardo DiCaprio", "Shahrukh Khan", "Taylor Swift", "Brad Pitt", "Angelina Jolie", "Will Smith", "Atif Aslam", "Fawad Khan", "Mahira Khan", "Dwayne Johnson", "Beyonce", "Johnny Depp", "Emma Watson", "Ali Zafar", "Zendaya", "Chris Hemsworth"],
          "charades_sportsmen": ["Lionel Messi", "Cristiano Ronaldo", "Babar Azam", "Virat Kohli", "LeBron James", "Serena Williams", "Muhammad Ali", "Usain Bolt", "Shaheen Afridi", "Roger Federer", "Rafael Nadal", "Imran Khan", "Wasim Akram", "Shoaib Akhtar", "Michael Jordan", "Tiger Woods"],
          "charades_politicians": ["Barack Obama", "Donald Trump", "Nelson Mandela", "Winston Churchill", "Abraham Lincoln", "Joe Biden", "Narendra Modi", "Justin Trudeau", "Angela Merkel", "Emmanuel Macron", "Vladimir Putin", "Jacinda Ardern", "Hillary Clinton", "George Bush", "Bill Clinton"],
          
          # Imposter Word Pairs
          "imposter_words": [
            ("Carpet", "Rug"), ("Curtain", "Blind"), ("Pillow", "Cushion"), ("Shampoo", "Body Wash"), 
            ("Broom", "Mop"), ("Jacket", "Sweater"), ("Wallet", "Purse"), ("Clock", "Watch"), 
            ("Notebook", "Diary"), ("Vase", "Jar"), ("Perfume", "Deodorant"), ("Towel", "Tissue"), 
            ("Suitcase", "Backpack"), ("Biryani", "Pulao"), ("Naan", "Roti"), ("Ice Cream", "Gelato"), 
            ("Soup", "Stew"), ("Muffin", "Cupcake"), ("Pancake", "Waffle"), ("Omelette", "Scrambled Eggs"), 
            ("Ketchup", "Hot Sauce"), ("Juice", "Smoothie"), ("Biscuit", "Cookie"), ("Butter", "Cheese"), 
            ("Jam", "Honey"), ("Babar Azam", "Virat Kohli"), ("Imran Khan", "Shahid Afridi"), 
            ("Atif Aslam", "Ali Zafar"), ("Fawad Khan", "Humayun Saeed"), ("Mahira Khan", "Mehwish Hayat"), 
            ("Elon Musk", "Mark Zuckerberg"), ("Tom Cruise", "Keanu Reeves"), ("Bill Gates", "Steve Jobs"), 
            ("Gordon Ramsay", "Jamie Oliver"), ("MrBeast", "PewDiePie"), ("Murree", "Swat"), 
            ("Pond", "Lake"), ("Hotel", "Motel"), ("River", "Canal"), ("Village", "Town"), 
            ("Street", "Highway"), ("Bridge", "Tunnel"), ("Mountain", "Volcano"), ("Island", "Peninsula"), 
            ("Airport", "Train Station"), ("Guitar", "Violin"), ("Sword", "Dagger"), ("Bicycle", "Motorcycle"), 
            ("Book", "Magazine"), ("Pen", "Marker"), ("Glasses", "Contacts"), ("Painting", "Photograph"), 
            ("Movie", "TV Show"), ("Poem", "Song"), ("Interview", "Interrogation")
          ],

          # Scribble Words
          "scribble_words": [
            "Apple", "Airplane", "Alien", "Angel", "Ant", "Backpack", "Banana", "Baseball", "Basketball", "Bat",
            "Beach", "Bear", "Bed", "Bee", "Bicycle", "Bird", "Boat", "Book", "Bottle", "Bow",
            "Bridge", "Broom", "Burger", "Bus", "Butterfly", "Cactus", "Cake", "Camera", "Candle", "Car",
            "Cat", "Castle", "Chair", "Cheese", "Chicken", "Clock", "Cloud", "Clown", "Coffee", "Cookie",
            "Cow", "Crab", "Crown", "Cup", "Diamond", "Dinosaur", "Doctor", "Dog", "Dolphin", "Door",
            "Dragon", "Drum", "Duck", "Eagle", "Earth", "Elephant", "Eye", "Fire", "Fish", "Flag",
            "Flower", "Fork", "Frog", "Ghost", "Giraffe", "Glasses", "Guitar", "Hamburger", "Hammer", "Hat",
            "Heart", "Helicopter", "Horse", "Hospital", "House", "Ice Cream", "Island", "Jacket", "Jellyfish", "Key",
            "Kite", "Knife", "Ladder", "Lamp", "Laptop", "Leaf", "Lemon", "Lion", "Lock", "Magnet",
            "Microphone", "Monkey", "Moon", "Mountain", "Mouse", "Mushroom", "Necklace", "Ninja", "Octopus", "Owl",
            "Pancake", "Pencil", "Penguin", "Piano", "Pig", "Pizza", "Planet", "Plant", "Police", "Popcorn",
            "Potato", "Pyramid", "Queen", "Rabbit", "Rainbow", "Robot", "Rocket", "Rose", "Sandwich", "Scissors",
            "Shark", "Sheep", "Ship", "Shoe", "Skeleton", "Snake", "Snowman", "Spider", "Spoon", "Star",
            "Submarine", "Sun", "Sunflower", "Sword", "Table", "Teapot", "Telephone", "Television", "Tent", "Tiger",
            "Toast", "Toilet", "Tooth", "Tornado", "Tractor", "Train", "Tree", "Truck", "Turtle", "Umbrella",
            "Unicorn", "Vampire", "Volcano", "Watch", "Watermelon", "Whale", "Wheel", "Windmill", "Window", "Wizard",
            "Zebra", "Zombie"
          ]
        }

    async def fetch_deck(self, mode: str):
        await asyncio.sleep(0.05) 
        return self._mock_db.get(mode, [])

db = DatabaseHandler()
active_rooms = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_code: str):
        await websocket.accept()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = []
        self.active_connections[room_code].append(websocket)

    def disconnect(self, websocket: WebSocket, room_code: str):
        if room_code in self.active_connections:
            if websocket in self.active_connections[room_code]:
                self.active_connections[room_code].remove(websocket)
            if not self.active_connections[room_code]:
                del self.active_connections[room_code]

    async def broadcast(self, message: dict, room_code: str):
        if room_code in self.active_connections:
            for connection in self.active_connections[room_code]:
                await connection.send_text(json.dumps(message))

manager = ConnectionManager()

def generate_room_code():
    return ''.join(random.choices(string.digits, k=4))

# --- IMPOSTER MULTIPLAYER SYNC ---
async def broadcast_imposter_state(room_code: str):
    room = active_rooms.get(room_code)
    if not room: 
        return
    
    base_state = {
        "type": "imposter_sync",
        "phase": room["imp_state"]["phase"],
        "turn_order": room["imp_state"]["turn_order"],
        "current_turn": room["imp_state"]["current_turn"],
        "resolution": room["imp_state"].get("resolution", None)
    }
    
    if room_code in manager.active_connections:
        for connection in manager.active_connections[room_code]:
            client_id = None
            for cid, c_info in room["players"].items():
                if c_info.get("socket") == connection:
                    client_id = cid
                    break
                    
            if client_id:
                client_state = dict(base_state)
                public_players = {}
                for pid, p_info in room["players"].items():
                    if p_info.get("name"):
                        public_players[pid] = {
                            "id": pid,
                            "name": p_info["name"],
                            "is_host": p_info["is_host"],
                            "is_alive": p_info.get("is_alive", True),
                            "ready": p_info.get("ready", False)
                        }
                client_state["players"] = public_players
                
                me = room["players"].get(client_id, {})
                client_state["my_role"] = me.get("role")
                client_state["my_word"] = me.get("word")
                client_state["is_alive"] = me.get("is_alive", True)
                
                await connection.send_text(json.dumps(client_state))

# --- SCRIBBLE MULTIPLAYER SYNC ---
async def broadcast_scribble_state(room_code: str):
    room = active_rooms.get(room_code)
    if not room:
        return

    sc = room["sc_state"]
    current_drawer_id = sc["turn_order"][sc["current_drawer_idx"]] if sc["turn_order"] else None
    
    # Generate letter hint mask for guessers
    word = sc.get("current_word", "")
    masked_word = ""
    for idx, ch in enumerate(word):
        if ch == " ":
            masked_word += " "
        elif idx in sc.get("revealed_indices", []):
            masked_word += ch
        else:
            masked_word += "_"

    base_state = {
        "type": "scribble_sync",
        "phase": sc["phase"],
        "current_round": sc["current_round"],
        "total_rounds": sc["total_rounds"],
        "time_limit": sc["time_limit"],
        "current_drawer_id": current_drawer_id,
        "correct_guessers": sc["correct_guessers"],
        "scores": sc["scores"],
        "chat": sc["chat"][-25:], # Send recent chat messages
        "word_options": sc.get("word_options", []),
        "word_length": len(word)
    }

    if room_code in manager.active_connections:
        for connection in manager.active_connections[room_code]:
            client_id = None
            for cid, c_info in room["players"].items():
                if c_info.get("socket") == connection:
                    client_id = cid
                    break

            if client_id:
                client_state = dict(base_state)
                # Public player list
                public_players = {}
                for pid, p_info in room["players"].items():
                    if p_info.get("name"):
                        public_players[pid] = {
                            "id": pid,
                            "name": p_info["name"],
                            "is_host": p_info["is_host"],
                            "score": sc["scores"].get(pid, 0),
                            "has_guessed": pid in sc["correct_guessers"]
                        }
                client_state["players"] = public_players

                # If you are the drawer or turn is over, you see full word. Otherwise, you see masked hint.
                if client_id == current_drawer_id or sc["phase"] in ["turn_end", "podium"]:
                    client_state["display_word"] = word
                else:
                    client_state["display_word"] = masked_word

                await connection.send_text(json.dumps(client_state))

@app.post("/create-room")
async def create_room():
    code = generate_room_code()
    while code in active_rooms:
        code = generate_room_code()
        
    active_rooms[code] = {
        "status": "lobby",
        "game_selected": None,
        "max_players": 20, 
        "players": {},
        "imp_state": {
            "phase": "lobby",
            "turn_order": [],
            "current_turn": 0,
            "votes": {}
        },
        "sc_state": {
            "phase": "lobby", # lobby, word_select, drawing, turn_end, podium
            "total_rounds": 2,
            "current_round": 1,
            "time_limit": 60,
            "turn_order": [],
            "current_drawer_idx": 0,
            "current_word": "",
            "word_options": [],
            "revealed_indices": [],
            "correct_guessers": [],
            "scores": {},
            "chat": []
        }
    }
    return {"room_code": code, "message": "Room created successfully"}

@app.websocket("/ws/{room_code}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, client_id: str):
    if room_code not in active_rooms:
        await websocket.close(code=4000, reason="Room not found")
        return

    room = active_rooms[room_code]
    
    if len(room["players"]) >= room["max_players"] and client_id not in room["players"]:
        await websocket.close(code=4003, reason="Room is full.")
        return

    await manager.connect(websocket, room_code)
    
    is_host = len(room["players"]) == 0
    if client_id not in room["players"]:
        room["players"][client_id] = {"id": client_id, "is_host": is_host, "socket": websocket}
    else:
        room["players"][client_id]["socket"] = websocket

    await websocket.send_text(json.dumps({
        "type": "room_state",
        "is_host": room["players"][client_id]["is_host"],
        "game_selected": room["game_selected"]
    }))
    
    if room["game_selected"] == "imposter":
        await broadcast_imposter_state(room_code)
    elif room["game_selected"] == "scribble":
        await broadcast_scribble_state(room_code)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            action = message.get("action")
            
            if action == "select_game":
                game_id = message.get("game_id")
                room["game_selected"] = game_id
                if game_id in ["truth_or_dare", "charades"]:
                    room["max_players"] = 1
                await manager.broadcast({"type": "game_selected", "game_id": game_id}, room_code)
            
            elif action == "fetch_deck":
                mode = message.get("mode")
                deck = await db.fetch_deck(mode)
                await websocket.send_text(json.dumps({"type": "deck_result", "deck": deck}))

            # --- IMPOSTER MULTIPLAYER ACTIONS ---
            elif action == "imp_join":
                room["players"][client_id]["name"] = message.get("name")
                room["players"][client_id]["is_alive"] = True
                await broadcast_imposter_state(room_code)
                
            elif action == "imp_set_order":
                room["imp_state"]["turn_order"] = message.get("order")
                room["imp_state"]["phase"] = "rules"
                
                alive_ids = [pid for pid, p in room["players"].items() if p.get("name")]
                num_imposters = 2 if len(alive_ids) > 6 else 1
                imposters = random.sample(alive_ids, num_imposters)
                
                word_pair = random.choice(db._mock_db["imposter_words"])
                is_reversed = random.choice([True, False])
                word_innocent = word_pair[1] if is_reversed else word_pair[0]
                word_imposter = word_pair[0] if is_reversed else word_pair[1]
                
                for pid in alive_ids:
                    room["players"][pid]["ready"] = False
                    room["players"][pid]["is_alive"] = True
                    if pid in imposters:
                        room["players"][pid]["role"] = "imposter"
                        room["players"][pid]["word"] = word_imposter
                    else:
                        room["players"][pid]["role"] = "innocent"
                        room["players"][pid]["word"] = word_innocent
                        
                await broadcast_imposter_state(room_code)

            elif action == "imp_ready":
                room["players"][client_id]["ready"] = True
                all_ready = all(p.get("ready", False) for p in room["players"].values() if p.get("name") and p.get("is_alive"))
                if all_ready:
                    room["imp_state"]["phase"] = "playing"
                    room["imp_state"]["current_turn"] = 0
                await broadcast_imposter_state(room_code)

            elif action == "imp_hint_given":
                turn_order = room["imp_state"]["turn_order"]
                curr_idx = room["imp_state"]["current_turn"]
                
                next_idx = curr_idx + 1
                while next_idx < len(turn_order) and not room["players"][turn_order[next_idx]].get("is_alive", False):
                    next_idx += 1
                    
                if next_idx >= len(turn_order):
                    room["imp_state"]["phase"] = "voting"
                    room["imp_state"]["votes"] = {}
                else:
                    room["imp_state"]["current_turn"] = next_idx
                    
                await broadcast_imposter_state(room_code)

            elif action == "imp_vote":
                target = message.get("target")
                room["imp_state"]["votes"][client_id] = target
                
                alive_count = sum(1 for p in room["players"].values() if p.get("name") and p.get("is_alive"))
                if len(room["imp_state"]["votes"]) >= alive_count:
                    votes = room["imp_state"]["votes"]
                    tally = {}
                    for v in votes.values():
                        tally[v] = tally.get(v, 0) + 1
                    
                    max_votes = max(tally.values())
                    leaders = [tgt for tgt, cnt in tally.items() if cnt == max_votes]
                    
                    eliminated_id = None
                    eliminated_role = None
                    
                    if len(leaders) == 1 and leaders[0] != "skip":
                        eliminated_id = leaders[0]
                        room["players"][eliminated_id]["is_alive"] = False
                        eliminated_role = room["players"][eliminated_id]["role"]
                        
                    active_imposters = sum(1 for p in room["players"].values() if p.get("name") and p.get("is_alive") and p.get("role") == "imposter")
                    active_innocents = sum(1 for p in room["players"].values() if p.get("name") and p.get("is_alive") and p.get("role") == "innocent")
                    
                    winner = None
                    if active_imposters == 0:
                        winner = "innocents"
                    elif active_imposters >= active_innocents:
                        winner = "imposters"

                    room["imp_state"]["phase"] = "resolution"
                    room["imp_state"]["resolution"] = {
                        "eliminated_id": eliminated_id,
                        "eliminated_role": eliminated_role,
                        "winner": winner
                    }
                
                await broadcast_imposter_state(room_code)

            elif action == "imp_next_round":
                room["imp_state"]["phase"] = "playing"
                room["imp_state"]["votes"] = {}
                room["imp_state"]["resolution"] = None
                
                turn_order = room["imp_state"]["turn_order"]
                first_alive = 0
                while first_alive < len(turn_order) and not room["players"][turn_order[first_alive]].get("is_alive"):
                    first_alive += 1
                room["imp_state"]["current_turn"] = first_alive
                
                await broadcast_imposter_state(room_code)

            elif action == "imp_play_again":
                room["imp_state"]["phase"] = "lobby"
                room["imp_state"]["turn_order"] = []
                room["imp_state"]["resolution"] = None
                for pid in room["players"]:
                    room["players"][pid]["ready"] = False
                    room["players"][pid]["is_alive"] = True
                await broadcast_imposter_state(room_code)

            # --- SCRIBBLE MULTIPLAYER ACTIONS ---
            elif action == "sc_join":
                room["players"][client_id]["name"] = message.get("name")
                sc = room["sc_state"]
                if client_id not in sc["scores"]:
                    sc["scores"][client_id] = 0
                await broadcast_scribble_state(room_code)

            elif action == "sc_config":
                sc = room["sc_state"]
                if "rounds" in message:
                    sc["total_rounds"] = int(message["rounds"])
                if "time_limit" in message:
                    sc["time_limit"] = int(message["time_limit"])
                await broadcast_scribble_state(room_code)

            elif action == "sc_start_game":
                sc = room["sc_state"]
                active_pids = [pid for pid, p in room["players"].items() if p.get("name")]
                random.shuffle(active_pids)
                sc["turn_order"] = active_pids
                sc["current_drawer_idx"] = 0
                sc["current_round"] = 1
                sc["chat"] = []
                sc["scores"] = {pid: 0 for pid in active_pids}
                
                # Choose 3 random words for drawer
                sc["word_options"] = random.sample(db._mock_db["scribble_words"], 3)
                sc["phase"] = "word_select"
                await broadcast_scribble_state(room_code)

            elif action == "sc_select_word":
                sc = room["sc_state"]
                sc["current_word"] = message.get("word")
                sc["revealed_indices"] = []
                sc["correct_guessers"] = []
                sc["phase"] = "drawing"
                await broadcast_scribble_state(room_code)
                await manager.broadcast({"type": "sc_clear_canvas"}, room_code)

            elif action == "sc_stroke":
                # Broadcast stroke coordinates to everyone else in the room
                stroke_data = message.get("data")
                await manager.broadcast({"type": "sc_draw_stroke", "data": stroke_data}, room_code)

            elif action == "sc_clear":
                await manager.broadcast({"type": "sc_clear_canvas"}, room_code)

            elif action == "sc_reveal_hint":
                sc = room["sc_state"]
                word = sc.get("current_word", "")
                unrevealed = [i for i, ch in enumerate(word) if ch != " " and i not in sc["revealed_indices"]]
                if unrevealed:
                    pick = random.choice(unrevealed)
                    sc["revealed_indices"].append(pick)
                    await broadcast_scribble_state(room_code)

            elif action == "sc_guess":
                sc = room["sc_state"]
                guess = message.get("text", "").strip()
                drawer_id = sc["turn_order"][sc["current_drawer_idx"]]
                player_name = room["players"][client_id].get("name", "Player")

                # If player is the drawer or already guessed correctly, do nothing
                if client_id == drawer_id or client_id in sc["correct_guessers"]:
                    continue

                if guess.lower() == sc["current_word"].lower():
                    # Correct guess!
                    sc["correct_guessers"].append(client_id)
                    time_left = message.get("time_left", 30)
                    
                    # Score math: Guessers get up to 500 pts based on speed
                    points = int(200 + (time_left / sc["time_limit"]) * 300)
                    sc["scores"][client_id] = sc["scores"].get(client_id, 0) + points
                    
                    # Drawer gets 50 points per person who guesses
                    sc["scores"][drawer_id] = sc["scores"].get(drawer_id, 0) + 75

                    sc["chat"].append({
                        "sender": "SYSTEM",
                        "text": f"🎉 {player_name} guessed the word!",
                        "is_correct": True
                    })
                    
                    # Check if all guessers got it right
                    total_guessers = len(sc["turn_order"]) - 1
                    if len(sc["correct_guessers"]) >= total_guessers:
                        sc["phase"] = "turn_end"
                        
                    await broadcast_scribble_state(room_code)
                else:
                    # Normal chat message
                    sc["chat"].append({
                        "sender": player_name,
                        "text": guess,
                        "is_correct": False
                    })
                    await broadcast_scribble_state(room_code)

            elif action == "sc_turn_timeout":
                sc = room["sc_state"]
                if sc["phase"] == "drawing":
                    sc["phase"] = "turn_end"
                    await broadcast_scribble_state(room_code)

            elif action == "sc_next_turn":
                sc = room["sc_state"]
                sc["current_drawer_idx"] += 1
                
                # Check if entire round is completed
                if sc["current_drawer_idx"] >= len(sc["turn_order"]):
                    sc["current_drawer_idx"] = 0
                    sc["current_round"] += 1

                # Check if game is over
                if sc["current_round"] > sc["total_rounds"]:
                    sc["phase"] = "podium"
                else:
                    sc["word_options"] = random.sample(db._mock_db["scribble_words"], 3)
                    sc["phase"] = "word_select"

                await broadcast_scribble_state(room_code)

            elif action == "sc_play_again":
                sc = room["sc_state"]
                sc["phase"] = "lobby"
                sc["turn_order"] = []
                sc["chat"] = []
                await broadcast_scribble_state(room_code)

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_code)
