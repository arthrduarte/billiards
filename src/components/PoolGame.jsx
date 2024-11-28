import React, { useState, useRef, useEffect } from 'react';
import './PoolGame.css';

const PoolGame = () => {
    const [isHolding, setIsHolding] = useState(false);
    const [cueAngle, setCueAngle] = useState(0);
    const [power, setPower] = useState(0);
    const [isMoving, setIsMoving] = useState(false);
    const [score, setScore] = useState(0);

    // Initial cue ball position
    const INITIAL_CUE_POS = { x: 600, y: 200 };

    // Use refs for values that don't need to trigger re-renders
    const ballPositionRef = useRef(INITIAL_CUE_POS);
    const ballVelocityRef = useRef({ x: 0, y: 0 });
    const cueBallRef = useRef(null);
    const animationFrameRef = useRef();

    // Pockets positions
    const pockets = [
        { x: 10, y: 10 },
        { x: 400, y: 10 },
        { x: 790, y: 10 },
        { x: 10, y: 390 },
        { x: 400, y: 390 },
        { x: 790, y: 390 }
    ];

    // Other balls state with initial positions and velocities
    const otherBallsRef = useRef([
        { id: 1, x: 200, y: 200, vx: 0, vy: 0, color: '#e74c3c', active: true },
        { id: 2, x: 230, y: 185, vx: 0, vy: 0, color: '#f1c40f', active: true },
        { id: 3, x: 230, y: 215, vx: 0, vy: 0, color: '#3498db', active: true },
        { id: 4, x: 260, y: 170, vx: 0, vy: 0, color: '#9b59b6', active: true },
        { id: 5, x: 260, y: 200, vx: 0, vy: 0, color: '#e67e22', active: true },
        { id: 6, x: 260, y: 230, vx: 0, vy: 0, color: '#2ecc71', active: true }
    ]);

    // Physics constants - adjusted for better collision handling
    const friction = 0.985; // Slightly reduced friction
    const minSpeed = 0.1;
    const ballRadius = 15;
    const restitution = 0.8;
    const ballMass = 1;
    const maxSpeed = 15; // Add maximum speed limit

    // Table boundaries
    const tableBounds = {
        left: 10 + ballRadius,
        right: 790 - ballRadius,
        top: 10 + ballRadius,
        bottom: 390 - ballRadius
    };

    // Improved collision detection
    const checkBallCollision = (ball1, ball2) => {
        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Also check if balls are moving towards each other
        if (distance < ballRadius * 2) {
            const vx = ball2.vx - ball1.vx;
            const vy = ball2.vy - ball1.vy;
            const dotProduct = dx * vx + dy * vy;
            return dotProduct < 0; // Only collide if moving towards each other
        }
        return false;
    };

    // Limit velocity to prevent tunneling
    const limitVelocity = (vx, vy) => {
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > maxSpeed) {
            const ratio = maxSpeed / speed;
            return {
                x: vx * ratio,
                y: vy * ratio
            };
        }
        return { x: vx, y: vy };
    };

    // Handle elastic collision between two balls
    const handleBallCollision = (ball1, ball2) => {
        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return; // Avoid division by zero

        // Normal vector
        const nx = dx / distance;
        const ny = dy / distance;

        // Tangent vector
        const tx = -ny;
        const ty = nx;

        // Dot product tangent
        const dpTan1 = ball1.vx * tx + ball1.vy * ty;
        const dpTan2 = ball2.vx * tx + ball2.vy * ty;

        // Dot product normal
        const dpNorm1 = ball1.vx * nx + ball1.vy * ny;
        const dpNorm2 = ball2.vx * nx + ball2.vy * ny;

        // Conservation of momentum in 1D
        const m1 = ballMass;
        const m2 = ballMass;
        const v1 = dpNorm1;
        const v2 = dpNorm2;

        const v1Final = (v1 * (m1 - m2) + 2 * m2 * v2) / (m1 + m2);
        const v2Final = (v2 * (m2 - m1) + 2 * m1 * v1) / (m1 + m2);

        // Update velocities
        ball1.vx = tx * dpTan1 + nx * v1Final;
        ball1.vy = ty * dpTan1 + ny * v1Final;
        ball2.vx = tx * dpTan2 + nx * v2Final;
        ball2.vy = ty * dpTan2 + ny * v2Final;

        // Move balls apart to prevent sticking
        const overlap = (ballRadius * 2) - distance;
        if (overlap > 0) {
            ball1.x -= (overlap/2) * nx;
            ball1.y -= (overlap/2) * ny;
            ball2.x += (overlap/2) * nx;
            ball2.y += (overlap/2) * ny;
        }
    };

    // Check if a ball is in a pocket
    const checkPocketCollision = (ballX, ballY) => {
        return pockets.some(pocket => {
            const dx = pocket.x - ballX;
            const dy = pocket.y - ballY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < 20; // Pocket radius
        });
    };

    // Reset cue ball position
    const resetCueBall = () => {
        ballPositionRef.current = { ...INITIAL_CUE_POS };
        ballVelocityRef.current = { x: 0, y: 0 };
        if (cueBallRef.current) {
            cueBallRef.current.setAttribute('cx', INITIAL_CUE_POS.x);
            cueBallRef.current.setAttribute('cy', INITIAL_CUE_POS.y);
        }
    };

    useEffect(() => {
        const updateBallPosition = () => {
            if (!isMoving) return;

            let isAnyBallMoving = false;

            // Update positions with smaller steps for better collision detection
            const steps = 3; // Divide each frame into smaller steps
            const dtStep = 1 / steps;

            for (let step = 0; step < steps; step++) {
                // Update cue ball position
                let newX = ballPositionRef.current.x + ballVelocityRef.current.x * dtStep;
                let newY = ballPositionRef.current.y + ballVelocityRef.current.y * dtStep;

                // Check if cue ball fell in pocket
                if (checkPocketCollision(newX, newY)) {
                    resetCueBall();
                    isAnyBallMoving = true;
                    break;
                }

                // Wall collisions for cue ball
                if (newX <= tableBounds.left) {
                    newX = tableBounds.left;
                    ballVelocityRef.current.x = Math.abs(ballVelocityRef.current.x) * restitution;
                } else if (newX >= tableBounds.right) {
                    newX = tableBounds.right;
                    ballVelocityRef.current.x = -Math.abs(ballVelocityRef.current.x) * restitution;
                }

                if (newY <= tableBounds.top) {
                    newY = tableBounds.top;
                    ballVelocityRef.current.y = Math.abs(ballVelocityRef.current.y) * restitution;
                } else if (newY >= tableBounds.bottom) {
                    newY = tableBounds.bottom;
                    ballVelocityRef.current.y = -Math.abs(ballVelocityRef.current.y) * restitution;
                }

                ballPositionRef.current = { x: newX, y: newY };

                // Update other balls with sub-steps
                otherBallsRef.current = otherBallsRef.current.map(ball => {
                    if (!ball.active) return ball;

                    let newBallX = ball.x + ball.vx * dtStep;
                    let newBallY = ball.y + ball.vy * dtStep;

                    if (checkPocketCollision(newBallX, newBallY)) {
                        setScore(prev => prev + 1);
                        return { ...ball, active: false };
                    }

                    // Wall collisions
                    if (newBallX <= tableBounds.left) {
                        newBallX = tableBounds.left;
                        ball.vx = Math.abs(ball.vx) * restitution;
                    } else if (newBallX >= tableBounds.right) {
                        newBallX = tableBounds.right;
                        ball.vx = -Math.abs(ball.vx) * restitution;
                    }

                    if (newBallY <= tableBounds.top) {
                        newBallY = tableBounds.top;
                        ball.vy = Math.abs(ball.vy) * restitution;
                    } else if (newBallY >= tableBounds.bottom) {
                        newBallY = tableBounds.bottom;
                        ball.vy = -Math.abs(ball.vy) * restitution;
                    }

                    return {
                        ...ball,
                        x: newBallX,
                        y: newBallY
                    };
                });

                // Check collisions between balls
                const cueBall = {
                    x: ballPositionRef.current.x,
                    y: ballPositionRef.current.y,
                    vx: ballVelocityRef.current.x,
                    vy: ballVelocityRef.current.y
                };

                // Ball-to-ball collisions
                otherBallsRef.current.forEach(ball => {
                    if (ball.active && checkBallCollision(cueBall, ball)) {
                        handleBallCollision(cueBall, ball);
                        const limitedVel = limitVelocity(cueBall.vx, cueBall.vy);
                        ballVelocityRef.current.x = limitedVel.x;
                        ballVelocityRef.current.y = limitedVel.y;
                    }
                });

                for (let i = 0; i < otherBallsRef.current.length; i++) {
                    for (let j = i + 1; j < otherBallsRef.current.length; j++) {
                        const ball1 = otherBallsRef.current[i];
                        const ball2 = otherBallsRef.current[j];
                        if (ball1.active && ball2.active && checkBallCollision(ball1, ball2)) {
                            handleBallCollision(ball1, ball2);
                            const limitedVel1 = limitVelocity(ball1.vx, ball1.vy);
                            const limitedVel2 = limitVelocity(ball2.vx, ball2.vy);
                            ball1.vx = limitedVel1.x;
                            ball1.vy = limitedVel1.y;
                            ball2.vx = limitedVel2.x;
                            ball2.vy = limitedVel2.y;
                        }
                    }
                }
            }

            // Apply friction once per frame
            ballVelocityRef.current = {
                x: ballVelocityRef.current.x * friction,
                y: ballVelocityRef.current.y * friction
            };

            otherBallsRef.current = otherBallsRef.current.map(ball => ({
                ...ball,
                vx: ball.vx * friction,
                vy: ball.vy * friction
            }));

            // Check if any ball is still moving
            if (Math.abs(ballVelocityRef.current.x) > minSpeed || 
                Math.abs(ballVelocityRef.current.y) > minSpeed) {
                isAnyBallMoving = true;
            }

            otherBallsRef.current.forEach(ball => {
                if (Math.abs(ball.vx) > minSpeed || Math.abs(ball.vy) > minSpeed) {
                    isAnyBallMoving = true;
                }
            });

            // Update DOM
            if (cueBallRef.current) {
                cueBallRef.current.setAttribute('cx', ballPositionRef.current.x);
                cueBallRef.current.setAttribute('cy', ballPositionRef.current.y);
            }

            otherBallsRef.current.forEach(ball => {
                if (ball.active) {
                    const ballElement = document.getElementById(`ball${ball.id}`);
                    if (ballElement) {
                        ballElement.setAttribute('cx', ball.x);
                        ballElement.setAttribute('cy', ball.y);
                    }
                }
            });

            if (!isAnyBallMoving) {
                setIsMoving(false);
                return;
            }

            animationFrameRef.current = requestAnimationFrame(updateBallPosition);
        };

        if (isMoving) {
            animationFrameRef.current = requestAnimationFrame(updateBallPosition);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isMoving]);

    // Add event listeners to window
    useEffect(() => {
        const handleGlobalMouseMove = (e) => {
            if (isHolding) {
                const svg = document.getElementById('poolTable');
                const svgRect = svg.getBoundingClientRect();
                const pt = svg.createSVGPoint();
                
                // Get mouse position relative to window
                pt.x = e.clientX;
                pt.y = e.clientY;
                
                // Transform to SVG coordinates
                const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
                
                const angle = Math.atan2(
                    svgP.y - ballPositionRef.current.y,
                    svgP.x - ballPositionRef.current.x
                ) * 180 / Math.PI;
                setCueAngle(angle);

                const distance = Math.sqrt(
                    Math.pow(svgP.x - ballPositionRef.current.x, 2) + 
                    Math.pow(svgP.y - ballPositionRef.current.y, 2)
                );
                const newPower = Math.min(Math.max(distance - 50, 0), 100);
                setPower(newPower);
            }
        };

        const handleGlobalMouseUp = () => {
            if (isHolding && power > 0) {
                const hitAngle = (cueAngle + 180) * Math.PI / 180;
                const speed = Math.min(power * 0.3, maxSpeed); // Reduced power multiplier
                const velocity = limitVelocity(
                    Math.cos(hitAngle) * speed,
                    Math.sin(hitAngle) * speed
                );
                ballVelocityRef.current = velocity;
                setIsMoving(true);
            }
            setIsHolding(false);
            setPower(0);
        };

        // Add global event listeners
        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        // Cleanup
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isHolding, power, cueAngle]);

    const handleMouseDown = (e) => {
        if (e.target.id === 'cueBall' && !isMoving) {
            setIsHolding(true);
        }
    };

    // Calculate cue stick end points
    const cueLength = 200;
    const cueOffset = 20;
    const powerOffset = power * 1.5;
    const cueEndX = ballPositionRef.current.x + (cueLength + cueOffset + powerOffset) * Math.cos(cueAngle * Math.PI / 180);
    const cueEndY = ballPositionRef.current.y + (cueLength + cueOffset + powerOffset) * Math.sin(cueAngle * Math.PI / 180);
    const cueStartX = ballPositionRef.current.x + (cueOffset + powerOffset) * Math.cos(cueAngle * Math.PI / 180);
    const cueStartY = ballPositionRef.current.y + (cueOffset + powerOffset) * Math.sin(cueAngle * Math.PI / 180);

    // Calculate guide line end point
    const getGuideLineEndPoint = () => {
        const lineLength = 1000; // Make it long enough to cross the table
        const angle = (cueAngle + 180) * Math.PI / 180; // Same angle as the shot
        return {
            x: ballPositionRef.current.x + lineLength * Math.cos(angle),
            y: ballPositionRef.current.y + lineLength * Math.sin(angle)
        };
    };

    return (
        <div className="game-container">
            <div className="score">Score: {score}</div>
            <svg 
                id="poolTable" 
                width="800" 
                height="400" 
                viewBox="0 0 800 400"
                onMouseDown={handleMouseDown}
            >
                {/* Table border */}
                <rect x="0" y="0" width="800" height="400" fill="#27ae60" stroke="#2c3e50" strokeWidth="20"/>
                
                {/* Guide line */}
                {isHolding && !isMoving && (
                    <>
                        <line
                            x1={ballPositionRef.current.x}
                            y1={ballPositionRef.current.y}
                            x2={getGuideLineEndPoint().x}
                            y2={getGuideLineEndPoint().y}
                            stroke="white"
                            strokeWidth="1"
                            strokeDasharray="5,5"
                            opacity="0.5"
                        />
                        <circle 
                            cx={ballPositionRef.current.x}
                            cy={ballPositionRef.current.y}
                            r="2"
                            fill="white"
                            opacity="0.5"
                        />
                    </>
                )}
                
                {/* Pockets */}
                {pockets.map((pocket, index) => (
                    <circle 
                        key={index}
                        cx={pocket.x}
                        cy={pocket.y}
                        r="20"
                        fill="#2c3e50"
                    />
                ))}
                
                {/* Other balls */}
                {otherBallsRef.current.map(ball => ball.active && (
                    <circle
                        key={ball.id}
                        id={`ball${ball.id}`}
                        className="ball"
                        cx={ball.x}
                        cy={ball.y}
                        r="15"
                        fill={ball.color}
                    />
                ))}

                {/* Power indicator */}
                {isHolding && (
                    <text 
                        x="20" 
                        y="30" 
                        fill="white" 
                        fontSize="20"
                        style={{ userSelect: 'none' }}
                    >
                        Power: {Math.round(power)}%
                    </text>
                )}

                {/* Cue stick */}
                {isHolding && !isMoving && (
                    <line
                        x1={cueStartX}
                        y1={cueStartY}
                        x2={cueEndX}
                        y2={cueEndY}
                        stroke="#8B4513"
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                )}

                {/* Cue ball */}
                <circle 
                    id="cueBall" 
                    ref={cueBallRef}
                    cx={ballPositionRef.current.x} 
                    cy={ballPositionRef.current.y} 
                    r="15" 
                    fill="white" 
                    stroke="#ccc"
                    style={{ cursor: isMoving ? 'default' : 'pointer' }}
                />
            </svg>
        </div>
    );
};

export default PoolGame; 