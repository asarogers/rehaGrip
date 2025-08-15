classdef MotorApiTest < matlab.unittest.TestCase
    % MATLAB integration tests for RehaGrip Motor Control API
    % Assumes FastAPI is running locally on port 3001.

    properties (Constant)
        BaseURL = "http://localhost:3001";
        RIGHT_CENTER_TICK = 3046;
        LEFT_CENTER_TICK  = 1000;
        FULL_TICKS        = 4095;
    end

    methods (TestClassSetup)
        function checkServerUp(tc)
            % Ping server/status so we fail early if API isn't up
            try
                r = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/status", struct());
                tc.assertTrue(isfield(r, "center_tick"), ...
                    "Server isn't responding. Start it then rerun tests.");
            catch ME
                tc.assertFail("Could not reach FastAPI server: %s", ME.message);
            end
        end
    end

    %% ---------- Tests ----------
    methods (Test)
        function test_status_initial_centered_right(tc)
            r = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/status", struct());
            tc.verifyEqual(r.center_tick, tc.RIGHT_CENTER_TICK);
            tc.verifyLessThan(abs(r.position), 0.01);
            tc.verifyTrue(r.torque);
            tc.verifyFalse(r.emergency);
            tc.verifyFalse(r.locked);
        end

        function test_center_sets_current_tick(tc)
            % Move somewhere first (+30 deg on right hand)
            targetDeg = 30;
            targetTick = MotorApiTest.deg_to_tick(tc.RIGHT_CENTER_TICK, targetDeg);
            jr = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/move", struct("position", targetDeg));
            tc.verifyEqual(int32(jr.target_tick), targetTick); % Convert to int32

            % Now set center to current
            r2 = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/center", struct());
            tc.verifyEqual(int32(r2.center_tick), targetTick); % Convert to int32

            % Status should report ~0 deg
            r3 = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/status", struct());
            tc.verifyLessThan(abs(r3.position), 0.01);
        end

        function test_move_respects_velocity_and_bounds(tc)
            data = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/move", ...
                struct("position", 1000, "velocity", 222));
            tc.verifyGreaterThanOrEqual(data.position_tick, 0);
            tc.verifyLessThanOrEqual(data.position_tick, tc.FULL_TICKS);
            % We can't directly inspect fake registers here; this only validates clamping works
        end

        function test_move_left_hand_inverts_sign(tc)
            % Switch to left
            r = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/hand", struct("hand","left"));
            tc.verifyEqual(int32(r.center_tick), int32(tc.LEFT_CENTER_TICK)); % Convert both to int32

            % Move +30 => requested_degrees should be -30
            j = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/move", struct("position", 30));
            tc.verifyEqual(j.requested_degrees, -30.0);

            expectedTick = int32(tc.LEFT_CENTER_TICK + (-30.0 * (4095/360.0)));
            tc.verifyEqual(int32(j.target_tick), expectedTick); % Convert to int32
            tc.verifyEqual(int32(j.position_tick), expectedTick); % Convert to int32
        end

        function test_move_blocked_when_locked_torque_off_or_emergency(tc)
            % Lock
            MotorApiTest.httpPost(tc.BaseURL + "/api/motor/lock", struct("locked", true));
            r2 = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/move", struct("position", 10), true);
            tc.verifyTrue(isfield(r2, "error"));

            % Unlock, torque off
            MotorApiTest.httpPost(tc.BaseURL + "/api/motor/lock", struct("locked", false));
            MotorApiTest.httpPost(tc.BaseURL + "/api/motor/torque", struct("torque", false));
            r3 = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/move", struct("position", 10), true);
            tc.verifyTrue(isfield(r3, "error"));

            % Torque on, but emergency stop
            MotorApiTest.httpPost(tc.BaseURL + "/api/motor/torque", struct("torque", true));
            MotorApiTest.httpPost(tc.BaseURL + "/api/motor/emergency", struct("stop", true));
            r4 = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/move", struct("position", 10), true);
            tc.verifyTrue(isfield(r4, "error"));
            % clear emergency
            MotorApiTest.httpPost(tc.BaseURL + "/api/motor/emergency", struct("stop", false));
        end

        function test_get_range(tc)
            r = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/get_range", struct());
            tc.verifyEqual(int32(r.center_tick), int32(tc.RIGHT_CENTER_TICK)); % Convert to int32
            tc.verifyClass(r.min_degrees, "double");
            tc.verifyClass(r.max_degrees, "double");
            tc.verifyClass(r.total_range, "double");
            tc.verifyLessThan(abs(r.total_range - 360.0), 1.0);
        end

        function test_recenter_sets_middle_as_center(tc)
            r = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/recenter", struct());
            tc.verifyLessThanOrEqual(abs(double(r.center_tick) - 2048), 1);

            s = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/status", struct());
            tc.verifyLessThan(abs(s.position), 0.01);
        end

        function test_hand_switch_moves_and_sets_center(tc)
            r = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/hand", struct("hand","left"));
            tc.verifyEqual(string(r.hand), "left"); % Convert to string
            tc.verifyEqual(int32(r.center_tick), int32(tc.LEFT_CENTER_TICK)); % Convert to int32

            r2 = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/hand", struct("hand","right"));
            tc.verifyEqual(string(r2.hand), "right"); % Convert to string
            tc.verifyEqual(int32(r2.center_tick), int32(tc.RIGHT_CENTER_TICK)); % Convert to int32
        end

        function test_lock_endpoint(tc)
            r = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/lock", struct("locked", true));
            tc.verifyTrue(r.locked);

            r2 = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/lock", struct("locked", false));
            tc.verifyFalse(r2.locked);
        end

        function test_torque_endpoint_and_offset_snapshot(tc)
            MotorApiTest.httpPost(tc.BaseURL + "/api/motor/move", struct("position", 15));
            rOff = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/torque", struct("torque", false));
            tc.verifyFalse(rOff.torque);
            rOn = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/torque", struct("torque", true));
            tc.verifyTrue(rOn.torque);
        end

        function test_emergency_stop_toggle(tc)
            r = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/emergency", struct("stop", true));
            tc.verifyTrue(r.emergency);
            r2 = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/emergency", struct("stop", false));
            tc.verifyFalse(r2.emergency);
        end

        function test_presets_get_post_reload_and_clamp(tc)
            g = MotorApiTest.httpGet(tc.BaseURL + "/api/motor/presets");
            tc.verifyTrue(g.ok);
            % Fix: presets should be a struct array, not py.list
            tc.verifyClass(g.presets, "struct"); 
            
            count = double(g.count);
            tc.verifyEqual(count, length(g.presets)); % Direct length comparison

            presetFile = string(g.preset_file);

            new_presets = struct("presets", [
                struct("name","A","pos",-1000), ...
                struct("name","B","pos",0), ...
                struct("name","C","pos",1000) ...
            ]);
            s = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/presets", new_presets);
            tc.verifyTrue(s.ok);
            tc.verifyTrue(s.saved_to_file);
            tc.verifyEqual(length(s.presets), 3);

            % Inspect file for clamping
            fileData = jsondecode(fileread(expanduser(presetFile)));
            stored = fileData.presets;
            tc.verifyEqual(stored(1).pos, -60);
            tc.verifyEqual(stored(3).pos, 60);

            % Reload
            rld = MotorApiTest.httpPost(tc.BaseURL + "/api/motor/presets/reload", struct());
            tc.verifyTrue(rld.ok);
            tc.verifyEqual(double(rld.count), 3);
        end
    end

    %% ---------- Helpers ----------
    methods (Static)
        function t = deg_to_tick(center_tick, deg)
            FULL_TICKS = MotorApiTest.FULL_TICKS;
            t = int32(center_tick + (deg * (FULL_TICKS/360.0)));
        end

        function tf = almost_equal(a, b, tol)
            if nargin < 3, tol = 1e-6; end
            tf = abs(a - b) <= tol;
        end

        function out = httpGet(url)
            opts = weboptions('Timeout', 30, 'ContentType','json');
            out = webread(url, opts);
        end

        function out = httpPost(url, payload, allowError)
            if nargin < 3, allowError = false; end
            opts = weboptions('Timeout', 30, 'MediaType','application/json', 'ContentType','json');
            try
                out = webwrite(url, payload, opts);
            catch ME
                % When API returns 400, MATLAB throws. If allowError==true, parse body.
                if allowError
                    % Try to extract JSON from the error message body
                    try
                        body = string(ME.cause{1}.ResponseBody);
                        out = jsondecode(body);
                    catch
                        rethrow(ME);
                    end
                else
                    rethrow(ME);
                end
            end
        end

        function c = toCell(x)
            % Robustly convert py.list or MATLAB array to cell array for counting
            if isa(x, 'py.list')
                c = cell(x);
            elseif iscell(x)
                c = x;
            else
                c = num2cell(x);
            end
        end
    end
end

function p = expanduser(pth)
% Expand ~ in paths (Linux/macOS)
if startsWith(pth,"~")
    p = fullfile(getenv("HOME"), extractAfter(pth,1));
else
    p = char(pth);
end
end